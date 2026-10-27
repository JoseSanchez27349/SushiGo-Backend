import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { enviarCodigo2FA, enviarRecuperacionContrasena } from '../services/email.service';

const JWT_SECRET = process.env.JWT_SECRET || 'sushigo_secret_key';

// 1. Registro de Cliente
export const registerCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, apellido, telefono, correoElectronico, contrasena, activar2FA } = req.body;

    if (!nombre || !apellido || !telefono || !correoElectronico || !contrasena) {
      res.status(400).json({ message: 'Todos los campos obligatorios deben ser completados' });
      return;
    }

    const usuarioExiste = await prisma.user.findFirst({
      where: {
        OR: [{ correoElectronico }, { telefono }],
      },
    });

    if (usuarioExiste) {
      res.status(400).json({ message: 'El correo o teléfono ya se encuentra registrado' });
      return;
    }

    // Obtener o crear rol 'Cliente'
    let rolCliente = await prisma.role.findUnique({ where: { nombre: 'Cliente' } });
    if (!rolCliente) {
      rolCliente = await prisma.role.create({
        data: { nombre: 'Cliente', descripcion: 'Consumidor final app/web' },
      });
    }

    const contrasenaHash = await bcrypt.hash(contrasena, 10);

    const nuevoUsuario = await prisma.user.create({
      data: {
        nombre,
        apellido,
        telefono,
        correoElectronico,
        contrasenaHash,
        dosFactoresActivado: Boolean(activar2FA),
        rolId: rolCliente.id,
      },
    });

    res.status(201).json({
      message: 'Cliente registrado con éxito',
      usuario: {
        id: nuevoUsuario.id,
        nombre: nuevoUsuario.nombre,
        correoElectronico: nuevoUsuario.correoElectronico,
        dosFactoresActivado: nuevoUsuario.dosFactoresActivado,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error interno al registrar cliente', error });
  }
};

// 2. Login de Cliente
export const loginCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { correoElectronico, contrasena } = req.body;

    const usuario = await prisma.user.findUnique({
      where: { correoElectronico },
      include: { rol: true },
    });

    if (!usuario || !usuario.contrasenaHash || !usuario.estaActivo) {
      res.status(401).json({ message: 'Credenciales inválidas' });
      return;
    }

    const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasenaHash);
    if (!contrasenaValida) {
      res.status(401).json({ message: 'Credenciales inválidas' });
      return;
    }

    // Si tiene 2FA activado
    if (usuario.dosFactoresActivado) {
      const codigo2fa = Math.floor(100000 + Math.random() * 900000).toString();
      const expiracion2fa = new Date(Date.now() + 10 * 60 * 1000); // 10 min

      await prisma.user.update({
        where: { id: usuario.id },
        data: { codigo2fa, expiracion2fa },
      });

      await enviarCodigo2FA(usuario.correoElectronico!, codigo2fa);

      res.status(200).json({
        requires2FA: true,
        message: 'Código de verificación enviado al correo electrónico',
        correoElectronico: usuario.correoElectronico,
      });
      return;
    }

    // Login normal sin 2FA
    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol.nombre },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      requires2FA: false,
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correoElectronico: usuario.correoElectronico,
        rol: usuario.rol.nombre,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en inicio de sesión', error });
  }
};

// 3. Verificar código 2FA
export const verify2FACode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { correoElectronico, codigo } = req.body;

    const usuario = await prisma.user.findUnique({
      where: { correoElectronico },
      include: { rol: true },
    });

    if (!usuario || !usuario.codigo2fa || !usuario.expiracion2fa) {
      res.status(400).json({ message: 'Petición inválida o código no generado' });
      return;
    }

    if (usuario.codigo2fa !== codigo || new Date() > usuario.expiracion2fa) {
      res.status(400).json({ message: 'Código de verificación inválido o expirado' });
      return;
    }

    // Limpiar código usado
    await prisma.user.update({
      where: { id: usuario.id },
      data: { codigo2fa: null, expiracion2fa: null },
    });

    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol.nombre },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correoElectronico: usuario.correoElectronico,
        rol: usuario.rol.nombre,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error verificando 2FA', error });
  }
};

// 4. Solicitar recuperación de contraseña
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { correoElectronico } = req.body;

    const usuario = await prisma.user.findUnique({ where: { correoElectronico } });
    if (!usuario) {
      // Por seguridad no se expone si existe o no
      res.status(200).json({ message: 'Si el correo está registrado, se enviará un enlace de recuperación' });
      return;
    }

    const tokenRecuperacion = crypto.randomBytes(32).toString('hex');
    const expiracionTokenRecuperacion = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await prisma.user.update({
      where: { id: usuario.id },
      data: { tokenRecuperacion, expiracionTokenRecuperacion },
    });

    await enviarRecuperacionContrasena(usuario.correoElectronico!, tokenRecuperacion);

    res.status(200).json({ message: 'Si el correo está registrado, se enviará un enlace de recuperación' });
  } catch (error) {
    res.status(500).json({ message: 'Error solicitando recuperación de contraseña', error });
  }
};

// 5. Restablecer contraseña con token
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, nuevaContrasena } = req.body;

    const usuario = await prisma.user.findFirst({
      where: {
        tokenRecuperacion: token,
        expiracionTokenRecuperacion: { gte: new Date() },
      },
    });

    if (!usuario) {
      res.status(400).json({ message: 'El token de recuperación es inválido o ha expirado' });
      return;
    }

    const contrasenaHash = await bcrypt.hash(nuevaContrasena, 10);

    await prisma.user.update({
      where: { id: usuario.id },
      data: {
        contrasenaHash,
        tokenRecuperacion: null,
        expiracionTokenRecuperacion: null,
      },
    });

    res.status(200).json({ message: 'Contraseña actualizada con éxito' });
  } catch (error) {
    res.status(500).json({ message: 'Error actualizando la contraseña', error });
  }
};