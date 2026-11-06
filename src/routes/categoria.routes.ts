import { Router } from 'express';
import {
  crearCategoria,
  obtenerCategorias,
  actualizarCategoria,
  eliminarCategoria,
} from '../controllers/Catologo/categoria.controller';
import { autenticarToken, permitirRoles } from '../middlewares/auth.middleware';

const router = Router();

// Consultar categorías lo puede hacer todo el personal autenticado (Admin, Mesero, Cocina)
router.get('/', autenticarToken, obtenerCategorias);

// Modificaciones restringidas solo a Administrador
router.post('/', autenticarToken, permitirRoles('Admin'), crearCategoria);
router.put('/:id', autenticarToken, permitirRoles('Admin'), actualizarCategoria);
router.delete('/:id', autenticarToken, permitirRoles('Admin'), eliminarCategoria);

export default router;
