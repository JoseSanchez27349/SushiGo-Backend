import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';

const ROLES_OPERATIVOS = ['Mesero', 'Cocina'] as const;

export const registerStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, apellido, telefono, codigoEmpleado, pin } = req.body ?? {};
    const rolRecibido = req.body?.rolNombre === 'Chef' ? 'Cocina' : req.body?.rolNombre;

    if (!nombre || !apellido || !telefono || !codigoEmpleado || !pin || !rolRecibido) {
      res.status(400).json({
        message: 'Completa nombre, apellido, teléfono, código, PIN y rol',
      });
      return;
    }

    if (!/^\d{4}$/.test(String(pin))) {
      res.status(400).json({ message: 'El PIN debe ser de 4 dígitos numéricos' });
      return;
    }

    if (!ROLES_OPERATIVOS.includes(rolRecibido)) {
      res.status(400).json({ message: 'El rol solo puede ser Mesero o Chef' });
      return;
    }

    const rol = await prisma.role.findUnique({ where: { nombre: rolRecibido } });
    if (!rol) {
      res.status(404).json({ message: `El rol '${rolRecibido}' no existe` });
      return;
    }

    const duplicado = await prisma.user.findFirst({
      where: { OR: [{ telefono }, { codigoEmpleado }] },
    });

    if (duplicado) {
      const campo = duplicado.telefono === telefono ? 'teléfono' : 'código de empleado';
      res.status(409).json({ message: `El ${campo} ya está registrado` });
      return;
    }

    await prisma.user.create({
      data: {
        nombre: String(nombre).trim(),
        apellido: String(apellido).trim(),
        telefono: String(telefono).trim(),
        codigoEmpleado: String(codigoEmpleado).trim(),
        pinHash: await bcrypt.hash(String(pin), 10),
        rolId: rol.id,
      },
    });

    res.status(201).json({ message: 'Cuenta de personal creada. Ya puedes entrar con tu código y PIN' });
  } catch (error) {
    console.error('Error en registerStaff:', error);
    res.status(500).json({ message: 'No se pudo crear la cuenta' });
  }
};

export const registerAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, apellido, telefono, correoElectronico } = req.body ?? {};
    const password = req.body?.contrasena || req.body?.password;

    if (!nombre || !apellido || !telefono || !correoElectronico || !password) {
      res.status(400).json({ message: 'Todos los campos son obligatorios' });
      return;
    }

    const rol = await prisma.role.findUnique({ where: { nombre: 'Admin' } });
    if (!rol) {
      res.status(404).json({ message: 'El rol Admin no existe' });
      return;
    }

    const duplicado = await prisma.user.findFirst({
      where: {
        OR: [{ telefono }, { correoElectronico: String(correoElectronico).trim() }],
      },
    });

    if (duplicado) {
      const campo = duplicado.telefono === telefono ? 'teléfono' : 'correo';
      res.status(409).json({ message: `El ${campo} ya está registrado` });
      return;
    }

    await prisma.user.create({
      data: {
        nombre: String(nombre).trim(),
        apellido: String(apellido).trim(),
        telefono: String(telefono).trim(),
        correoElectronico: String(correoElectronico).trim(),
        contrasenaHash: await bcrypt.hash(String(password), 10),
        rolId: rol.id,
      },
    });

    res.status(201).json({ message: 'Cuenta de administrador creada. Ya puedes iniciar sesión' });
  } catch (error) {
    console.error('Error en registerAdmin:', error);
    res.status(500).json({ message: 'No se pudo crear la cuenta' });
  }
};
