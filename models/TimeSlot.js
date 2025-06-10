const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    index: true,
    get: (date) => date.toISOString().split('T')[0],
    set: (date) => new Date(date.setUTCHours(0, 0, 0, 0)) // Formatear al obtener
  },
  startTime: {
    type: String,
    required: true
  },
  duration: {
    type: Number, // en minutos
    default: 30
  },
  maxCapacity: {
    type: Number,
    default: 10
  },
  currentReservations: {
    type: Number,
    default: 0
  },
  isAvailable: {
    type: Boolean,
    default: true
  }
},{ toJSON: { getters: true } });

// Índice compuesto para búsquedas rápidas
timeSlotSchema.index({ date: 1, startTime: 1 }, { unique: true });

module.exports = mongoose.model('TimeSlot', timeSlotSchema);

