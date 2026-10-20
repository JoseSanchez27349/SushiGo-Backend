import express from 'express';
import routes from './routes';
import { errorHandler } from './middlewares/error.middleware';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api', routes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Servidor SushiGo corriendo en http://localhost:${PORT}`);
});