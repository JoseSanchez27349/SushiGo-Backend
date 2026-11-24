import { Router } from 'express';
import {
  abrirOAsignarTurno,
  obtenerMiTurnoActivo,
  registrarMovimientoCaja,
  cerrarTurnoCaja,
  obtenerMonitoreoTurnosAdmin,
  obtenerMiHistorial, // 🛠️ NUEVO: Importar la función
} from '../controllers/Caja/turno.controller';
import { autenticarToken, permitirRoles } from '../middlewares/auth.middleware';

const router = Router();

router.post(
  '/abrir',
  autenticarToken,
  permitirRoles('Admin', 'Mesero'),
  abrirOAsignarTurno,
);

router.get(
  '/mi-turno',
  autenticarToken,
  permitirRoles('Admin', 'Mesero'),
  obtenerMiTurnoActivo,
);

// 🛠️ NUEVO: Ruta para el historial del mesero
router.get(
  '/mi-historial',
  autenticarToken,
  permitirRoles('Admin', 'Mesero'),
  obtenerMiHistorial,
);

router.post(
  '/:turnoId/movimientos',
  autenticarToken,
  permitirRoles('Admin', 'Mesero'),
  registrarMovimientoCaja,
);

router.post(
  '/:turnoId/cerrar',
  autenticarToken,
  permitirRoles('Admin', 'Mesero'),
  cerrarTurnoCaja,
);

router.get(
  '/admin/monitoreo',
  autenticarToken,
  permitirRoles('Admin'),
  obtenerMonitoreoTurnosAdmin,
);

export default router;