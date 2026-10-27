import { Router } from 'express';
import { loginWithPin } from '../controllers/auth.controller';
import {
  registerCustomer,
  loginCustomer,
  verify2FACode,
  forgotPassword,
  resetPassword,
} from '../controllers/customerAuth.controller';

const router = Router();

// Auth Staff
router.post('/login-pin', loginWithPin);

// Auth Clientes
router.post('/customer/register', registerCustomer);
router.post('/customer/login', loginCustomer);
router.post('/customer/verify-2fa', verify2FACode);
router.post('/customer/forgot-password', forgotPassword);
router.post('/customer/reset-password', resetPassword);

export default router;