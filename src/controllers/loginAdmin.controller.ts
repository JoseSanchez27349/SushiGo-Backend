import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { getJwtSecret } from '../config/jwt';

export const loginAdmin = async (req: Request, res: Response) => {
  try {
    const { correoElectronico } = req.body ?? {};
    const password: unknown = req.body?.password ?? req.body?.contrasena;

    // 1. Validar campos requeridos
    if (
      typeof correoElectronico !== 'string' ||
      typeof password !== 'string' ||
      !correoElectronico.trim() ||
      !password
    ) {
      return res
        .status(400)
        .json({ message: 'El correo electrónico y la contraseña son obligatorios' });
    }

    // 2. Buscar usuario por correo incluyendo su Rol
    const user = await prisma.user.findFirst({
      where: {
        correoElectronico: {
          equals: correoElectronico.trim(),
          mode: 'insensitive',
        },
      },
      include: { rol: true },
    });

    // 3. Validar existencia, estado activo y que tenga contraseña
    if (!user || !user.contrasenaHash || !user.estaActivo) {
      return res.status(401).json({ message: 'Credenciales inválidas o usuario inactivo' });
    }

    // 4. Validar rol exclusivo de administración
    if (user.rol.nombre !== 'Admin') {
      return res
        .status(403)
        .json({ message: 'Acceso denegado. El personal operativo debe ingresar con PIN' });
    }

    // 5. Comparar contraseña en texto plano con el hash
    const isPasswordValid = await bcrypt.compare(password, user.contrasenaHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // 6. Generar JWT
    const payload = {
      userId: user.id,
      correoElectronico: user.correoElectronico!,
      role: user.rol.nombre,
    };

    const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '8h' });

    return res.status(200).json({
      message: 'Autenticación administrativa exitosa',
      token,
      user: {
        id: user.id,
        nombre: `${user.nombre} ${user.apellido}`,
        correoElectronico: user.correoElectronico,
        role: user.rol.nombre,
      },
    });
  } catch (error) {
    console.error('Error en loginAdmin:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};
