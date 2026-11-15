import http from 'http';
import app from './app'; // o tu instancia de express()
import { initSocket } from './config/socket';

const PORT = process.env.PORT || 3000;
const httpServer = http.createServer(app);

// Inicializar WebSockets sobre el mismo servidor HTTP
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor SushiGo + WebSockets corriendo en http://localhost:${PORT}`);
});