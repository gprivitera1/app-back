require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');
const TimeSlot = require('./models/TimeSlot');
const Reservation = require('./models/Reservation'); // Añade al inicio


// Datos iniciales de productos
const initialProducts = [
  {
    name: 'JetSky',
    price: 100,
    requiresHelmet: true,
    requiresVest: true,
    maxPeople: 2,
    maxConsecutiveSlots: 3, // Nuevo campo
    description: 'JetSky para 1-2 personas con chaleco salvavidas'
  },
  {
    name: 'Cuatriciclos',
    price: 80,
    requiresHelmet: true,
    requiresVest: false,
    maxPeople: 2,
    maxConsecutiveSlots: 3, // Nuevo campo
    description: 'Cuatriciclos para 1-2 personas con casco'
  },
  {
    name: 'Equipo de buceo',
    price: 50,
    requiresHelmet: false,
    requiresVest: false,
    maxConsecutiveSlots: 3, // Nuevo campo
    description: 'Equipo completo de buceo para una persona'
  },
  {
    name: 'Tabla de surf adulto',
    price: 40,
    requiresHelmet: false,
    requiresVest: false,
    maxConsecutiveSlots: 3, // Nuevo campo
    description: 'Tabla de surf para adultos'
  },
  {
    name: 'Tabla de surf niño',
    price: 30,
    requiresHelmet: false,
    requiresVest: false,
    maxConsecutiveSlots: 3, // Nuevo campo
    description: 'Tabla de surf para niños'
  }
];

// Función para inicializar productos
const initializeProducts = async () => {
  try {
    console.log('Eliminando productos existentes...');
    const deleteResult = await Product.deleteMany({});
    console.log(`Eliminados ${deleteResult.deletedCount} productos`);
    
    console.log('Insertando nuevos productos...');
    const result = await Product.insertMany(initialProducts);
    console.log(`✅ Insertados ${result.length} productos`);
    
    return true;
  } catch (error) {
    console.error('❌ Error detallado:', error.message);
    if (error.errors) {
      console.error('Errores de validación:', error.errors);
    }
    return false;
  }
};

const initializeTimeSlots = async () => {
  try {
    await TimeSlot.deleteMany({});
    
    const daysToGenerate = 7;
    const startHour = 8;
    const endHour = 18;
    const slotDuration = 30;
    const slots = [];
    
    const now = new Date();
    
    for (let i = 0; i < daysToGenerate; i++) {
      // Crear fecha en UTC sin componente horario
      const date = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + i
      ));
      date.setUTCHours(0, 0, 0, 0);
      
      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += slotDuration) {
          const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          
          slots.push({
            date: date, // Fecha limpia en UTC
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
    console.log('✅ Slots de tiempo inicializados con éxito');
    return true;
  } catch (error) {
    console.error('❌ Error inicializando slots de tiempo:', error);
    return false;
  }
};


// Función para inicializar reservas (vacía)
const initializeReservations = async () => {
  try {
    await Reservation.deleteMany({});
    console.log('✅ Colección de reservas inicializada (vacía)');
    return true;
  } catch (error) {
    console.error('❌ Error inicializando reservas:', error);
    return false;
  }
};


// Añadir esta parte al final del archivo
const initializeDB = async () => {
  try {
    // Conectar a MongoDB usando la URI de las variables de entorno
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Conectado a MongoDB');

    // Ejecutar las funciones de inicialización
    const productsInitialized = await initializeProducts();
    const timeSlotsInitialized = await initializeTimeSlots();
    const reservationsInitialized = await initializeReservations(); // Nueva

    if (productsInitialized && timeSlotsInitialized && reservationsInitialized) {
      console.log('✅ Todos los datos inicializados correctamente');
    } else {
      console.log('❌ Hubo errores al inicializar los datos');
    }
  } catch (error) {
    console.error('❌ Error de conexión o inicialización:', error);
  } finally {
    // Cerrar la conexión
    await mongoose.disconnect();
    console.log('Desconectado de MongoDB');
  }
};

// Ejecutar la función principal
initializeDB();