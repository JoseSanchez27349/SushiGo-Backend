import { Router } from 'express';
import {
  actualizarProducto,
  crearProducto,
  eliminarProducto,
  obtenerProductoPorId,
  obtenerProductos,
} from '../controllers/Catologo/producto.controller';
import { autenticarToken, permitirRoles } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', autenticarToken, obtenerProductos);
router.get('/:id', autenticarToken, obtenerProductoPorId);
router.post('/', autenticarToken, permitirRoles('Admin'), crearProducto);
router.put('/:id', autenticarToken, permitirRoles('Admin'), actualizarProducto);
router.delete('/:id', autenticarToken, permitirRoles('Admin'), eliminarProducto);

export default router;
