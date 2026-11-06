import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt';

// 1. Middleware para validar el Token JWT
export const autenticarToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer TOKEN"

  if (!token) {
    res.status(401).json({ message: 'Acceso denegado: Token no proporcionado' });
    return;
  }

  const secret = getJwtSecret();
  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === 'string') {
      res.status(403).json({ message: 'Token inválido o expirado' });
      return;
    }

    const id = typeof decoded.id === 'string' ? decoded.id : decoded.userId;
    const rol = typeof decoded.rol === 'string' ? decoded.rol : decoded.role;
    if (typeof id !== 'string' || typeof rol !== 'string') {
      res.status(403).json({ message: 'Token inválido o expirado' });
      return;
    }

    req.usuario = {
      id,
      rol,
      ...(typeof decoded.correoElectronico === 'string'
        ? { correoElectronico: decoded.correoElectronico }
        : {}),
    };
    next();
  } catch {
    res.status(403).json({ message: 'Token inválido o expirado' });
    return;
  }
};

// 2. Middleware para Control de Acceso basado en Roles (RBAC)
export const permitirRoles = (...rolesPermitidos: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      res.status(403).json({
        message: `Acceso prohibido: Se requiere rol [${rolesPermitidos.join(', ')}]`,
      });
      return;
    }

    next();
  };
};
