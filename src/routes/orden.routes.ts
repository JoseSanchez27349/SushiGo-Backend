import { Router } from 'express';
import { crearOrden, obtenerOrdenesActivas } from '../controllers/Ordenes/orden.controller';
import { autenticarToken, permitirRoles } from '../middlewares/auth.middleware';

const router = Router();

router.get(
  '/activas',
  autenticarToken,
  permitirRoles('Admin', 'Mesero', 'Cocina'),
  obtenerOrdenesActivas,
);
router.post('/', autenticarToken, permitirRoles('Admin', 'Mesero'), crearOrden);

export default router;
