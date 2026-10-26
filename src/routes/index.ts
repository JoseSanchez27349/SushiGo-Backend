import { Router } from 'express';
import authRoutes from './auth.routes';
// import staffRoutes from './staff.routes';

const router = Router();

// ⚠️ AQUÍ SE AGREGA '/v1/auth'
router.use('/v1/auth', authRoutes);

// Si tienes rutas de staff/POS/KDS:
// router.use('/v1/staff', staffRoutes);

export default router;