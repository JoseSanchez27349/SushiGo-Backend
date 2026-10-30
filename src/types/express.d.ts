export interface JwtUsuarioPayload {
  id: string;
  correoElectronico?: string;
  rol: string;
}

declare global {
  namespace Express {
    interface Request {
      usuario?: JwtUsuarioPayload;
    }
  }
}