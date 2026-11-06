import express from 'express';
import routes from './routes';
import { errorHandler } from './middlewares/error.middleware';

const app = express();

// 1. Lectura de JSON
app.use(express.json());

// 2. LOGGER: Imprime en la consola cada petición que entra
app.use((req, res, next) => {
  console.log(`➡️  Petición recibida: [${req.method}] ${req.url}`);
  next();
});

// Rutas de autenticación, staff y usuarios
app.use('/api', routes);

// 4. Manejador 404 en JSON (reemplaza el HTML por defecto)
app.use((req, res) => {
  console.log(`❌ Ruta NO encontrada: [${req.method}] ${req.url}`);
  res.status(404).json({
    error: 'Ruta no encontrada',
    metodo: req.method,
    urlRecibida: req.url,
    sugerencia: 'Verifica la URL en Postman o el prefijo en app.ts',
  });
});

app.use(errorHandler);

export default app;
