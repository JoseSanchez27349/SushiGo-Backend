import { Router } from 'express';
import {
  crearOrden,
  obtenerOrdenesActivas,
  agregarItemsOrden,
  cancelarOrden,
  obtenerMisOrdenes,
} from '../controllers/Ordenes/orden.controller';
import { autenticarToken, permitirRoles } from '../middlewares/auth.middleware';

const router = Router();

router.get(
  '/activas',
  autenticarToken,
  permitirRoles('Admin', 'Mesero', 'Cocina'),
  obtenerOrdenesActivas,
);
router.post('/', autenticarToken, permitirRoles('Admin', 'Mesero'), crearOrden);
router.post('/:id/items', autenticarToken, permitirRoles('Admin', 'Mesero'), agregarItemsOrden);
router.put(
  '/:id/cancelar',
  autenticarToken,
  permitirRoles('Admin', 'Mesero', 'Cliente'),
  cancelarOrden
);
router.get('/mis-ordenes', autenticarToken, obtenerMisOrdenes);

export default router;