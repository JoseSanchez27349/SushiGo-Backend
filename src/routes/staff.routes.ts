// src/routes/staff.routes.ts
import { Router } from 'express';
import { autenticarToken } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/rbac.middleware';

const router = Router();

// Endpoint KDS Cocina: Permitido solo para Admin y Cocina
router.get('/kitchen/orders', autenticarToken, authorizeRoles('Admin', 'Cocina'), (req, res) => {
  res.json({ message: 'Acceso concedido a órdenes de cocina (KDS)' });
});

// Endpoint POS Salón: Permitido solo para Admin y Mesero
router.get('/pos/tables', autenticarToken, authorizeRoles('Admin', 'Mesero'), (req, res) => {
  res.json({ message: 'Acceso concedido a la gestión de mesas (POS)' });
});

export default router;
