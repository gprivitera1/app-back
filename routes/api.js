const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const productController = require('../controllers/productController');
// const paymentController = require('../controllers/paymentController');

// Rutas de productos
router.get('/products', productController.getAllProducts);

// Rutas de reservas
router.get('/available-times', reservationController.getAvailableTimes);
router.post('/reservations', reservationController.createReservation);
router.put('/reservations/:id/cancel', reservationController.cancelReservation);

router.get('/reservations', reservationController.getReservations); // Nueva ruta
router.delete('/reservations/:id', reservationController.cancelReservation); // Cambiado a DELET
router.get('/reservations/:id', reservationController.getReservationById);

router.delete('/reservations/:id', reservationController.cancelReservation);


//router.post('/payment-intent', paymentController.createPaymentIntent);
//router.post('/stripe-webhook', express.raw({type: 'application/json'}), paymentController.stripeWebhook);
//router.post('/reservations/:id/refund', reservationController.processStormRefund);

module.exports = router;