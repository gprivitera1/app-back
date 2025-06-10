const Reservation = require('../models/Reservation');
const Product = require('../models/Product');
const TimeSlot = require('../models/TimeSlot');
const moment = require('moment');
const mongoose = require('mongoose'); 

// Calcular precio total de la reserva
const calculateTotalPrice = (products, stormInsurance) => {
  let total = products.reduce((sum, item) => {
    const productPrice = item.product.price;
    return sum + (productPrice * item.quantity * item.slots);
  }, 0);

  // Aplicar descuento del 10% por múltiples productos
  if (products.length > 1) {
    total = total * 0.9;
  }

  // Agregar seguro de tormenta (20% del total)
  if (stormInsurance) {
    total = total * 1.2;
  }

  return total;
};

exports.getAvailableTimes = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ message: 'Se requiere la fecha' });
    }

    // Crear rango de fechas (todo el día)
    const startDate = new Date(date + 'T00:00:00Z');
    const endDate = new Date(date + 'T23:59:59Z');
    
    // Verificar que la fecha no sea mayor a 48 horas en el futuro
    const now = new Date();
    const maxDate = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    
    if (startDate > maxDate) {
      return res.status(400).json({ 
        message: 'No se pueden reservar turnos con más de 48 horas de anticipación' 
      });
    }

    // Buscar slots en el rango de fechas
    const timeSlots = await TimeSlot.find({ 
      date: {
        $gte: startDate,
        $lte: endDate
      },
      isAvailable: true
    });

    // Filtrar slots con capacidad disponible
    const availableTimes = timeSlots
      .filter(slot => slot.currentReservations < slot.maxCapacity)
      .map(slot => slot.startTime);

    res.json({ times: availableTimes });
  } catch (err) {
    console.error('Error en getAvailableTimes:', err);
    res.status(500).json({ message: err.message });
  }
};

// Crear una nueva reserva
// MODIFICAR createReservation para usar transacciones
exports.createReservation = async (req, res) => {
  
  try {
    const { 
      customer, 
      date, 
      startTime, 
      products, 
      paymentMethod, 
      currency, 
      stormInsurance 
    } = req.body;

    // Validar fecha y hora
    const reservationDate = new Date(date);
    console.log("date " + date);
    console.log("startTime " + startTime);
    console.log("products  " + JSON.stringify(products));
    const now = new Date();
    const maxReservationDate = new Date(now.getTime() + 48 * 60 * 60 * 1000);

     console.log("maxReservationDate" + maxReservationDate);
    
    if (reservationDate > maxReservationDate) {
      return res.status(400).json({ 
        message: 'No se pueden reservar turnos con más de 48 horas de anticipación' 
      });
    }

    const productIds = products.map(p => p.product);
    const dbProducts = await Product.find({ _id: { $in: productIds } })



 // Validación de máximo de personas por producto
   for (const item of products) {
      const product = dbProducts.find(p => p._id.toString() === item.product);
      if (product.maxPeople && item.quantity > product.maxPeople) {
        throw new Error(`El producto ${product.name} permite máximo ${product.maxPeople} personas`);
      }
    }

const startUTC = new Date(date);
startUTC.setUTCHours(0, 0, 0, 0);

const endUTC = new Date(startUTC);
endUTC.setUTCDate(endUTC.getUTCDate() + 1);

// Buscar slots que caigan en este rango de 24h
const timeSlot = await TimeSlot.findOne({
  date: {
    $gte: startUTC,
    $lt: endUTC
  },
  startTime: startTime
});

    console.log("el timeSlot es " + timeSlot);

    if (!timeSlot || !timeSlot.isAvailable || 
        timeSlot.currentReservations >= timeSlot.maxCapacity) {
      return res.status(400).json({ 
        message: 'El horario seleccionado ya no está disponible' 
      });
    }

    
    // Mapear productos con sus detalles
    const reservationProducts = products.map(item => {
      const product = dbProducts.find(p => p._id.toString() === item.product);
      return {
        product: product._id,
        quantity: item.quantity,
        slots: item.slots,
        helmets: item.helmets || 0,
        vests: item.vests || 0
      };
    });

    // Validar requisitos de seguridad
    for (const item of reservationProducts) {
      const product = dbProducts.find(p => p._id.toString() === item.product.toString());
      
      if (product.requiresHelmet && item.helmets < item.quantity) {
        return res.status(400).json({ 
          message: `El producto ${product.name} requiere ${item.quantity} cascos` 
        });
      }
      
      if (product.requiresVest && item.vests < item.quantity) {
        return res.status(400).json({ 
          message: `El producto ${product.name} requiere ${item.quantity} chalecos salvavidas` 
        });
      }
    }

    // Calcular precio total
    const totalPrice = calculateTotalPrice(
      reservationProducts.map(item => ({
        ...item,
        product: dbProducts.find(p => p._id.toString() === item.product.toString())
      })), 
      stormInsurance
    );

    // Determinar estado según método de pago
    const getStatusByPaymentMethod = (method) => {
       const completedMethods = ['card', 'transfer'];
       return completedMethods.includes(method) ? 'confirmed' : 'pending';
    };

    // Crear reserva
    const reservation = new Reservation({
      customer,
      date: reservationDate,
      startTime,
      products: reservationProducts,
      totalPrice,
      paymentMethod,
      currency,
      stormInsurance,
      status: getStatusByPaymentMethod(paymentMethod)
    });

    // Guardar reserva
    const savedReservation = await reservation.save();

     // Actualización atómica del slot
    const updatedSlot = await TimeSlot.findOneAndUpdate(
      {
        _id: timeSlot._id,
        currentReservations: { $lt: timeSlot.maxCapacity }
      },
      {
        $inc: { currentReservations: 1 },
        $set: { 
          isAvailable: timeSlot.currentReservations + 1 < timeSlot.maxCapacity 
        }
      },
      { new: true }
    );

    if (!updatedSlot) {
      throw new Error('El horario ya no está disponible');
    }

    res.status(201).json(savedReservation);
  } catch (err) {
    res.status(400).json({ message: err.message });
  } 
};

// NUEVO MÉTODO PARA REEMBOLSOS POR TORMENTA
/*   exports.processStormRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await Reservation.findById(id);
    
    if (!reservation) {
      return res.status(404).json({ message: 'Reserva no encontrada' });
    }
    
    if (reservation.status !== 'completed') {
      return res.status(400).json({
        message: 'Solo reservas completadas pueden aplicar a reembolso por tormenta'
      });
    }

    // Calcular reembolso (50% del total)
    const refundAmount = reservation.totalPrice * 0.5;
    
    // Procesar reembolso con Stripe si fue pago digital
    if (reservation.paymentMethod !== 'cash') {
      await stripe.refunds.create({
        payment_intent: reservation.paymentDetails.transactionId,
        amount: Math.round(refundAmount * 100)
      });
    }

    // Actualizar reserva
    reservation.stormRefund = refundAmount;
    reservation.status = 'refunded';
    await reservation.save();

    res.json({ 
      message: 'Reembolso por tormenta procesado',
      refundAmount 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};   */

/// reservationController.js
exports.cancelReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await Reservation.findById(id);
    
    if (!reservation) {
      return res.status(404).json({ message: 'Reserva no encontrada' });
    }

    // Verificar si la reserva ya está cancelada
    if (reservation.status === 'cancelled') {
      return res.status(400).json({ message: 'La reserva ya está cancelada' });
    }

    // Combinar fecha y hora de la reserva
    const reservationDate = moment(reservation.date).format('YYYY-MM-DD');
    const reservationDateTime = moment(`${reservationDate} ${reservation.startTime}`, 'YYYY-MM-DD HH:mm');
    
    // Calcular diferencia con hora actual
    const now = moment();
    const hoursDifference = reservationDateTime.diff(now, 'hours');

    // Validar si se puede cancelar sin costo
    if (hoursDifference <= 2) {
      return res.status(400).json({ 
        message: 'Solo se pueden cancelar sin costo con más de 2 horas de anticipación' 
      });
    }

    // Actualizar estado de la reserva
    reservation.status = 'cancelled';
    await reservation.save();

    // Actualizar disponibilidad del slot
    const timeSlot = await TimeSlot.findOne({ 
      date: reservation.date, 
      startTime: reservation.startTime 
    });
    
    if (timeSlot) {
      timeSlot.currentReservations -= 1;
      if (timeSlot.currentReservations < timeSlot.maxCapacity) {
        timeSlot.isAvailable = true;
      }
      await timeSlot.save();
    }

    res.json({ 
      message: 'Reserva cancelada exitosamente',
      reservation
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getReservations = async (req, res) => {
  try {
    const { email, reservationId } = req.query;
    
    if (!email && !reservationId) {
      return res.status(400).json({ message: 'Se requiere email o ID de reserva' });
    }
    
    const query = {};
    if (email) query['customer.email'] = email;
    if (reservationId) query['_id'] = reservationId;
    
    const reservations = await Reservation.find(query)
      .populate('products.product')
      .sort({ createdAt: -1 });
    
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getReservationById = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('products.product');
    
    if (!reservation) {
      return res.status(404).json({ message: 'Reserva no encontrada' });
    }
    
    res.json(reservation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.cancelReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await Reservation.findById(id);
    
    if (!reservation) {
      return res.status(404).json({ message: 'Reserva no encontrada' });
    }

    // Calcular tiempo restante
// Obtener la fecha UTC de la reserva (ignorando la hora actual)
const reservationDateUTC = new Date(reservation.date);
const utcDate = new Date(Date.UTC(
  reservationDateUTC.getUTCFullYear(),
  reservationDateUTC.getUTCMonth(),
  reservationDateUTC.getUTCDate()
));

// Combinar con la hora local (startTime) en formato UTC
const [hours, minutes] = reservation.startTime.split(':').map(Number);
const reservationDateTime = new Date(utcDate);
reservationDateTime.setUTCHours(hours, minutes, 0, 0);

// Obtener hora actual en UTC
const now = new Date();
const nowUTC = new Date(Date.UTC(
  now.getUTCFullYear(),
  now.getUTCMonth(),
  now.getUTCDate(),
  now.getUTCHours(),
  now.getUTCMinutes(),
  now.getUTCSeconds()
));

// Calcular diferencia en horas
const timeDiff = reservationDateTime.getTime() - nowUTC.getTime();
const hoursDiff = timeDiff / (1000 * 60 * 60);

// Verificar política de cancelación (2 horas antes)
if (hoursDiff < 2) {
  return res.status(400).json({ 
    message: 'Solo se pueden cancelar reservas con al menos 2 horas de anticipación' 
  });
}

    // Actualizar estado de la reserva
    reservation.status = 'cancelled';
    await reservation.save();

    console.log("estatus " + reservation.status)

    // Actualizar disponibilidad del slot
    const timeSlot = await TimeSlot.findOne({ 
      date: reservation.date, 
      startTime: reservation.startTime 
    });
    
    if (timeSlot) {
      timeSlot.currentReservations -= 1;
      if (timeSlot.currentReservations < timeSlot.maxCapacity) {
        timeSlot.isAvailable = true;
      }
      await timeSlot.save();
    }

    res.json({ 
      message: 'Reserva cancelada exitosamente',
      refundAmount: hoursDiff > 2 ? reservation.totalPrice : 0
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Inicializar slots de tiempo (ejecutar solo una vez)
exports.initializeTimeSlots = async () => {
  try {
    // Eliminar slots existentes
    await TimeSlot.deleteMany({});
    
    // Crear slots para los próximos 7 días
    const daysToGenerate = 7;
    const startHour = 8; // 8:00 AM
    const endHour = 18;  // 6:00 PM
    const slotDuration = 30; // minutos
    
    const slots = [];
    const now = new Date();
    
    for (let i = 0; i < daysToGenerate; i++) {
      const date = new Date();
      date.setDate(now.getDate() + i);
      date.setHours(0, 0, 0, 0);
      
      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += slotDuration) {
          const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          
          slots.push({
            date,
            startTime,
            duration: slotDuration,
            maxCapacity: 10,
            currentReservations: 0,
            isAvailable: true
          });
        }
      }
    }
    
    await TimeSlot.insertMany(slots);
    console.log('Slots de tiempo inicializados con éxito');
  } catch (err) {
    console.error('Error inicializando slots de tiempo:', err);
  }
};