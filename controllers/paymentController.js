// controllers/paymentController.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Reservation = require('../models/Reservation');
const TimeSlot = require('../models/TimeSlot');

exports.createPaymentIntent = async (req, res) => {
  try {
    const { amount, currency, reservationId } = req.body;
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      metadata: { reservationId },
      payment_method_types: ['card'],
      description: `Reserva #${reservationId}`
    });

    // Actualizar reserva con ID de transacción
    await Reservation.findByIdAndUpdate(reservationId, {
      'paymentDetails.transactionId': paymentIntent.id
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle payment success
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const reservationId = paymentIntent.metadata.reservationId;

    await Reservation.findByIdAndUpdate(reservationId, {
      status: 'confirmed',
      'paymentDetails.status': 'succeeded',
      paymentConfirmed: true
    });
  }

  // Handle payment failure
  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object;
    const reservationId = paymentIntent.metadata.reservationId;

    // Liberar reserva después de 15 minutos
    setTimeout(async () => {
      const reservation = await Reservation.findById(reservationId);
      if (reservation && reservation.status === 'pending') {
        await reservation.remove();
        // Liberar slot de tiempo
        await TimeSlot.updateOne(
          { date: reservation.date, startTime: reservation.startTime },
          { $inc: { currentReservations: -1 } }
        );
      }
    }, 15 * 60 * 1000); // 15 minutos
  }

  res.json({ received: true });
};