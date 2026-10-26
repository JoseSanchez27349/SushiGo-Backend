// src/routes/auth.routes.ts
import { Router } from 'express';
import { loginWithPin } from '../controllers/auth.controller';

const router = Router();

// POST /api/v1/auth/login-pin
router.post('/login-pin', loginWithPin);

export default router;