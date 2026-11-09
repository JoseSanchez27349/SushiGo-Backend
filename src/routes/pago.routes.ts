import { Router } from 'express';
import {
  registrarPagoOrden,
  solicitarReimpresion,
  obtenerDetallePagoOrden,
} from '../controllers/Pagos/pago.controller';
import { autenticarToken, permitirRoles } from '../middlewares/auth.middleware';

const router = Router();

// Procesar cobro (efectivo, tarjeta o combinado)
router.post(
  '/orden/:ordenId',
  autenticarToken,
  permitirRoles('Admin', 'Mesero'),
  registrarPagoOrden,
);

// Generar reimpresión con registro de auditoría
router.post(
  '/orden/:ordenId/reimpresion',
  autenticarToken,
  permitirRoles('Admin', 'Mesero'),
  solicitarReimpresion,
);

// Consultar pagos y auditoría de la orden
router.get(
  '/orden/:ordenId',
  autenticarToken,
  permitirRoles('Admin', 'Mesero'),
  obtenerDetallePagoOrden,
);

export default router;
