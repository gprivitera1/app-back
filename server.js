require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();


app.use((req, res, next) => {
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  next();
});



// Solucionar error de ruta
const apiRoutes = require('./routes/api');  // Importación corregida

// Conectar a MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB conectado'))
.catch(err => console.error('Error de conexión a MongoDB:', err));

// Middleware
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api', apiRoutes);  // Uso de las rutas

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Backend del Parador Caribeño funcionando!');
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en puerto ${PORT}`);
});