import { Router } from 'express';
import authRoutes from './auth.routes';
import categoriaRoutes from './categoria.routes';
import cocinaRoutes from './cocina.routes';
import ingredienteRoutes from './ingrediente.routes';
import mesaRoutes from './mesa.routes';
import ordenRoutes from './orden.routes';
import productoRoutes from './producto.routes';
import recetaRoutes from './receta.routes';
import staffRoutes from './staff.routes';
import personalRoutes from './personal.routes';
import healthRoutes from './health.routes';
import pagoRoutes from './pago.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/v1/auth', authRoutes);
router.use('/v1/staff', staffRoutes);
router.use('/v1/usuarios', personalRoutes);
router.use('/v1/categorias', categoriaRoutes);
router.use('/v1/productos', productoRoutes);
router.use('/v1/ingredientes', ingredienteRoutes);
router.use('/v1/recetas', recetaRoutes);
router.use('/v1/ordenes', ordenRoutes);
router.use('/v1/cocina', cocinaRoutes);
router.use('/v1/mesas', mesaRoutes);
router.use('/v1/pagos', pagoRoutes);

export default router;
