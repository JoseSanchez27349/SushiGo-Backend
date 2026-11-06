import { Router } from 'express';
import authRoutes from './auth.routes';
import categoriaRoutes from './categoria.routes';
import ingredienteRoutes from './ingrediente.routes';
import productoRoutes from './producto.routes';
import recetaRoutes from './receta.routes';
import staffRoutes from './staff.routes';
import personalRoutes from './personal.routes';
import healthRoutes from './health.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/v1/auth', authRoutes);
router.use('/v1/staff', staffRoutes);
router.use('/v1/usuarios', personalRoutes);
router.use('/v1/categorias', categoriaRoutes);
router.use('/v1/productos', productoRoutes);
router.use('/v1/ingredientes', ingredienteRoutes);
router.use('/v1/recetas', recetaRoutes);

export default router;
