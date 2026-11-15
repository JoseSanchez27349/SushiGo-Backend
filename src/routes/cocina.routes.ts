import { Router } from 'express';
import {
  obtenerComandasCocina,
  cambiarEstadoCocina,
  cambiarEstadoItemCocina,
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
router.put(
  '/items/:itemId/estado',
  autenticarToken,
  permitirRoles('Admin', 'Cocina'),
  cambiarEstadoItemCocina,
);

export default router;