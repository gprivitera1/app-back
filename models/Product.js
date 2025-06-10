const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ['JetSky', 'Cuatriciclos', 'Equipo de buceo', 'Tabla de surf adulto', 'Tabla de surf niño']
  },
  price: {
    type: Number,
    required: true
  },
  requiresHelmet: {
    type: Boolean,
    default: false
  },
  requiresVest: {
    type: Boolean,
    default: false
  },
  maxPeople: {
    type: Number,
    default: 1
  },
  // Añade este nuevo campo
  maxConsecutiveSlots: {
    type: Number,
    default: 1 // Valor por defecto
  },
  description: String
});

module.exports = mongoose.model('Product', productSchema);