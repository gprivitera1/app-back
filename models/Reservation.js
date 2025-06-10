const mongoose = require('mongoose');

const productItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  slots: {
    type: Number,
    required: true,
    min: 1,
    max: 3
  },
  helmets: {
    type: Number,
    default: 0
  },
  vests: {
    type: Number,
    default: 0
  }
});

const reservationSchema = new mongoose.Schema({
  customer: {
    fullName: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    }
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  products: [productItemSchema],
  totalPrice: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['cash', 'card', 'transfer']
  },
  currency: {
    type: String,
    required: true,
    enum: ['local', 'usd', 'eur']
  },
  stormInsurance: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  paymentDue: Date,
  paymentDetails: {
    transactionId: String,
    amountPaid: Number,
    currency: String,
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled'],
      default: 'pending'
  }
  },
  stormRefund: {
    type: Number,
    default: 0
  },
  paymentConfirmed: {
    type: Boolean,
    default: false
  }
});

// Actualizar hook pre-save para UTC
reservationSchema.pre('save', function(next) {
  if (this.isModified('date') || this.isModified('startTime')) {
    const dateParts = this.date.toISOString().split('T')[0].split('-');
    const [hours, minutes] = this.startTime.split(':').map(Number);
    
    const utcDate = new Date(Date.UTC(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1, // Meses son 0-indexed
      parseInt(dateParts[2]),
      hours,
      minutes
    ));
    
    // Para pagos en efectivo
    if (this.paymentMethod === 'cash') {
      this.paymentDue = new Date(utcDate.getTime() - 2 * 60 * 60 * 1000);
    }
    
    // Para todas las reservas
    this.reservationDateTime = utcDate;
  }
  next();
});

module.exports = mongoose.model('Reservation', reservationSchema);