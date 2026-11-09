import { Router } from 'express';
import {
  obtenerComandasCocina,
  cambiarEstadoCocina,
} from '../controllers/Cocina/cocina.controller';
import { autenticarToken, permitirRoles } from '../middlewares/auth.middleware';

const router = Router();

router.get('/comandas', autenticarToken, permitirRoles('Admin', 'Cocina'), obtenerComandasCocina);
router.put(
  '/comandas/:ordenId/estado',
  autenticarToken,
  permitirRoles('Admin', 'Cocina'),
  cambiarEstadoCocina,
);

export default router;
