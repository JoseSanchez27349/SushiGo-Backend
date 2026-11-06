import { Router } from 'express';
import {
  crearPersonal,
  obtenerPersonal,
  actualizarPersonal,
  eliminarPersonal,
} from '../controllers/Usuarios/usuario.controller';
import { autenticarToken, permitirRoles } from '../middlewares/auth.middleware';

const router = Router();

router.use(autenticarToken, permitirRoles('Admin'));

// Se agrega '/staff' para que la URL completa sea /api/v1/usuarios/staff
router.post('/staff', crearPersonal);
router.get('/staff', obtenerPersonal);
router.put('/staff/:id', actualizarPersonal);
router.delete('/staff/:id', eliminarPersonal);

export default router;