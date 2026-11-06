import { Request, Response, NextFunction } from 'express';

export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    if (!allowedRoles.includes(req.usuario.rol)) {
      return res.status(403).json({
        message: `Acceso denegado: Se requiere uno de los siguientes roles [${allowedRoles.join(', ')}]`,
      });
    }

    next();
  };
};
