import { Router } from 'express';
import { loginWithPin } from '../controllers/auth.controller';
import { 
  registerCustomer, 
  loginCustomer, 
  verify2FACode, 
  forgotPassword, 
  resetPassword,
  obtenerPerfil 
} from '../controllers/customerAuth.controller';
import { autenticarToken, permitirRoles } from '../middlewares/auth.middleware';

const router = Router();

// Rutas Públicas
router.post('/customer/register', registerCustomer);
router.post('/customer/login', loginCustomer);
router.post('/customer/verify-2fa', verify2FACode);
router.post('/customer/forgot-password', forgotPassword);
router.post('/customer/reset-password', resetPassword);
// Auth Staff
router.post('/login-pin', loginWithPin);
// Ruta Protegida: Perfil
router.get('/me', autenticarToken, obtenerPerfil);

// Ruta Protegida: Dashboard de Admin
router.get('/admin/dashboard-stats', autenticarToken, permitirRoles('Administrador'), (req, res) => {
  res.json({ message: 'Bienvenido al panel de administración de SushiGo' });
});

export default router;