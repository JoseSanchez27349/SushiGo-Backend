import { Router } from 'express';
import { crearMesa, obtenerMesas, cambiarEstadoMesa } from '../controllers/Mesas/mesa.controller';
import { autenticarToken, permitirRoles } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', autenticarToken, obtenerMesas);
router.post('/', autenticarToken, permitirRoles('Admin'), crearMesa);
router.put('/:id/estado', autenticarToken, permitirRoles('Admin', 'Mesero'), cambiarEstadoMesa);

export default router;
