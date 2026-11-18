import { Router } from 'express';
import {
  obtenerMiCarrito,
  agregarItemCarrito,
  actualizarItemCarrito,
  eliminarItemCarrito,
  vaciarCarrito,
  checkoutCarrito,
} from '../controllers/Carrito/carrito.controller';
import { autenticarToken } from '../middlewares/auth.middleware';

const router = Router();

// Todas las operaciones del carrito requieren usuario autenticado (JWT)
router.use(autenticarToken);

// Consultar carrito activo y totales calculados
router.get('/', obtenerMiCarrito);

// Agregar producto o sumar cantidad al carrito
router.post('/items', agregarItemCarrito);

// Actualizar cantidad de un elemento específico del carrito
router.patch('/items/:itemId', actualizarItemCarrito);

// Eliminar un elemento específico del carrito
router.delete('/items/:itemId', eliminarItemCarrito);

// Vaciar todo el carrito
router.delete('/', vaciarCarrito);

// Confirmar pedido para recoger (crea Order + OrderItems y vacía el carrito)
router.post('/checkout', checkoutCarrito);

export default router;