import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtUsuarioPayload } from '../types/express';

// 1. Middleware para validar el Token JWT
export const autenticarToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer TOKEN"

  if (!token) {
    res.status(401).json({ message: 'Acceso denegado: Token no proporcionado' });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET || 'secreto_super_seguro';
    const decoded = jwt.verify(token, secret) as JwtUsuarioPayload;
    
    // Asignamos la información decodificada a req.usuario
    req.usuario = decoded;
    next();
  } catch (error) {
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