import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  res.status(500).json({
    error: 'InternalServerError',
    message: err.message || 'Ocurrió un error inesperado en el servidor.',
  });
};