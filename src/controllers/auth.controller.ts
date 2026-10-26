import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';

export const loginWithPin = async (req: Request, res: Response) => {
  try {
    const { codigoEmpleado, pin } = req.body;

    // 1. Validar presencia de credenciales
    if (!codigoEmpleado || !pin) {
      return res.status(400).json({ message: 'El código de empleado y el PIN son obligatorios' });
    }

    // 2. Validar formato de PIN de 4 dígitos numéricos
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ message: 'El PIN debe ser exactamente de 4 dígitos numéricos' });
    }

    // 3. Buscar usuario activo por su código de empleado de 4 caracteres
    const user = await prisma.user.findUnique({
      where: { codigoEmpleado },
      include: { rol: true },
    });

    if (!user || !user.pinHash || !user.estaActivo) {
      return res.status(401).json({ message: 'Credenciales inválidas o usuario inactivo' });
    }

    // 4. Comparar el PIN en texto plano con el hash de bcrypt en BD
    const isPinValid = await bcrypt.compare(pin, user.pinHash);
    if (!isPinValid) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // 5. Generar token JWT con vigencia de turno (8 horas)
    const payload = {
      userId: user.id,
      codigoEmpleado: user.codigoEmpleado!,
      role: user.rol.nombre, // "Admin", "Cocina", "Mesero"
    };

    const secret = process.env.JWT_SECRET || 'sushigo_jwt_secret_key_2026_production';
    const token = jwt.sign(payload, secret, { expiresIn: '8h' });

    // 6. Respuesta exitosa
    return res.status(200).json({
      message: 'Autenticación exitosa',
      token,
      user: {
        id: user.id,
        nombre: `${user.nombre} ${user.apellido}`,
        codigoEmpleado: user.codigoEmpleado,
        role: user.rol.nombre,
      },
    });
  } catch (error) {
    console.error('Error en loginWithPin:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
  
};
