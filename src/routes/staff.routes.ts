// src/routes/staff.routes.ts
import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/rbac.middleware';

const router = Router();

// Endpoint KDS Cocina: Permitido solo para Admin y Cocina
router.get(
  '/kitchen/orders',
  authenticateJWT,
  authorizeRoles('Admin', 'Cocina'),
  (req, res) => {
    res.json({ message: 'Acceso concedido a órdenes de cocina (KDS)' });
  }
);

// Endpoint POS Salón: Permitido solo para Admin y Mesero
router.get(
  '/pos/tables',
  authenticateJWT,
  authorizeRoles('Admin', 'Mesero'),
  (req, res) => {
    res.json({ message: 'Acceso concedido a la gestión de mesas (POS)' });
  }
);

export default router;