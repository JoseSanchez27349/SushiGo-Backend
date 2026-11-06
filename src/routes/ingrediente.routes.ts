import { Router } from 'express';
import {
  crearIngrediente,
  obtenerIngredientes,
  actualizarIngrediente,
  eliminarIngrediente,
} from '../controllers/Inventario/ingrediente.controller';
import { autenticarToken, permitirRoles } from '../middlewares/auth.middleware';

const router = Router();

// Consultar stock de ingredientes (Admin y Cocina)
router.get('/', autenticarToken, permitirRoles('Admin', 'Cocina'), obtenerIngredientes);

// Administración de insumos (Solo Admin)
router.post('/', autenticarToken, permitirRoles('Admin'), crearIngrediente);
router.put('/:id', autenticarToken, permitirRoles('Admin'), actualizarIngrediente);
router.delete('/:id', autenticarToken, permitirRoles('Admin'), eliminarIngrediente);

export default router;
