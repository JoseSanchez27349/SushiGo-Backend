import { Router } from 'express';
import { obtenerMetricasDashboard } from '../controllers/Admin/dashboard.controller';
import { autenticarToken, permitirRoles } from '../middlewares/auth.middleware';

const router = Router();

router.get('/dashboard', autenticarToken, permitirRoles('Admin'), obtenerMetricasDashboard);

export default router;