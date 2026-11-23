import express from 'express';
import routes from './routes';
import { errorHandler } from './middlewares/error.middleware';
import cors from 'cors';

const app = express();

// 1. Lectura de JSON
app.use(cors({
  origin: 'http://localhost:4200',
  credentials: true
}));

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// 2. LOGGER
app.use((req, res, next) => {
  console.log(`➡️  Petición recibida: [${req.method}] ${req.url}`);
  next();
});

// Rutas
app.use('/api', routes);

// 4. Manejador 404
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