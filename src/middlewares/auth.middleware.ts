import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt';

const extraerUsuarioJwt = (
  decoded: string | JwtPayload,
): { id: string; rol: string; correoElectronico?: string } | null => {
  if (typeof decoded === 'string') {
    return null;
  }

  const payload = decoded as JwtPayload & {
    id?: string;
    userId?: string;
    rol?: string;
    role?: string;
    correoElectronico?: string;
  };

  const id =
    typeof payload.id === 'string'
      ? payload.id
      : typeof payload.userId === 'string'
        ? payload.userId
        : null;
  const rol =
    typeof payload.rol === 'string'
      ? payload.rol
      : typeof payload.role === 'string'
        ? payload.role
        : null;

  if (!id || !rol) {
    return null;
  }

  return {
    id,
    rol,
    ...(typeof payload.correoElectronico === 'string'
      ? { correoElectronico: payload.correoElectronico }
      : {}),
  };
};

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
    const usuarioJwt = extraerUsuarioJwt(decoded);

    if (!usuarioJwt) {
      res.status(403).json({ message: 'Token inválido o expirado' });
      return;
    }

    req.usuario = usuarioJwt;
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
