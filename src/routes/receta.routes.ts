import { Router } from 'express';
import {
  guardarRecetaProducto,
  obtenerRecetaProducto,
  eliminarIngredienteDeReceta,
} from '../controllers/Inventario/receta.controller';
import { autenticarToken, permitirRoles } from '../middlewares/auth.middleware';

const router = Router();

// Consultar BOM / Receta (Admin y Cocina)
router.get(
  '/producto/:productoId',
  autenticarToken,
  permitirRoles('Admin', 'Cocina'),
  obtenerRecetaProducto,
);

// Editar y configurar BOM (Solo Admin)
router.post(
  '/producto/:productoId',
  autenticarToken,
  permitirRoles('Admin'),
  guardarRecetaProducto,
);
router.delete(
  '/producto/:productoId/ingrediente/:ingredienteId',
  autenticarToken,
  permitirRoles('Admin'),
  eliminarIngredienteDeReceta,
);

export default router;
