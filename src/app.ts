import express from 'express';
import authRoutes from './routes/auth.routes';

const app = express();

// 1. Lectura de JSON
app.use(express.json());

// 2. LOGGER: Imprime en la consola cada petición que entra
app.use((req, res, next) => {
  console.log(`➡️  Petición recibida: [${req.method}] ${req.url}`);
  next();
});

// 3. Rutas de Autenticación
app.use('/api/v1/auth', authRoutes);

// 4. Manejador 404 en JSON (reemplaza el HTML por defecto)
app.use((req, res) => {
  console.log(`❌ Ruta NO encontrada: [${req.method}] ${req.url}`);
  res.status(404).json({
    error: 'Ruta no encontrada',
    metodo: req.method,
    urlRecibida: req.url,
    sugerencia: 'Verifica la URL en Postman o el prefijo en app.ts'
  });
});

export default app;