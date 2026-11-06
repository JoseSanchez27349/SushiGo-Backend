import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import prisma from '../../config/prisma';

// Roles permitidos para gestión por esta vía
const ROLES_OPERATIVOS = ['Mesero', 'Cocina'];

// 1. CREAR MESERO O COCINERO
export const crearPersonal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, apellido, telefono, codigoEmpleado, pin, rolNombre } = req.body;

    if (!nombre || !apellido || !telefono || !codigoEmpleado || !pin || !rolNombre) {
      res.status(400).json({
        message: 'Campos requeridos: nombre, apellido, telefono, codigoEmpleado, pin, rolNombre',
      });
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      res.status(400).json({ message: 'El PIN debe ser de 4 dígitos numéricos' });
      return;
    }

    if (!ROLES_OPERATIVOS.includes(rolNombre)) {
      res.status(400).json({
        message: `Rol no permitido. Solo se puede crear personal de tipo: ${ROLES_OPERATIVOS.join(', ')}`,
      });
      return;
    }

    const rol = await prisma.role.findUnique({ where: { nombre: rolNombre } });
    if (!rol) {
      res.status(404).json({ message: `El rol '${rolNombre}' no existe en la base de datos` });
      return;
    }

    // Validar duplicados de teléfono o código de empleado
    const existeDuplicado = await prisma.user.findFirst({
      where: { OR: [{ telefono }, { codigoEmpleado }] },
    });

    if (existeDuplicado) {
      const campo = existeDuplicado.telefono === telefono ? 'teléfono' : 'código de empleado';
      res.status(409).json({ message: `El ${campo} ya está registrado` });
      return;
    }

    const pinHash = await bcrypt.hash(pin, 10);

    const nuevoUsuario = await prisma.user.create({
      data: {
        nombre,
        apellido,
        telefono,
        codigoEmpleado,
        pinHash,
        rolId: rol.id,
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        telefono: true,
        codigoEmpleado: true,
        estaActivo: true,
        rol: { select: { nombre: true } },
        creadoEn: true,
      },
    });

    res.status(201).json({ message: 'Personal registrado exitosamente', usuario: nuevoUsuario });
  } catch (error) {
    console.error('Error al crear personal:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// 2. LISTAR TODO EL PERSONAL OPERATIVO
export const obtenerPersonal = async (_req: Request, res: Response): Promise<void> => {
  try {
    const personal = await prisma.user.findMany({
      where: {
        rol: { nombre: { in: ROLES_OPERATIVOS } },
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        telefono: true,
        codigoEmpleado: true,
        estaActivo: true,
        rol: { select: { nombre: true } },
        creadoEn: true,
      },
      orderBy: { creadoEn: 'desc' },
    });

    res.status(200).json({ usuarios: personal });
  } catch (error) {
    console.error('Error al obtener personal:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// 3. ACTUALIZAR PERSONAL OPERATIVO
export const actualizarPersonal = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El ID debe ser un texto válido' });
      return;
    }

    const { nombre, apellido, telefono, codigoEmpleado, pin, rolNombre, estaActivo } = req.body;

    const usuarioActual = await prisma.user.findUnique({
      where: { id },
      include: { rol: true },
    });

    if (!usuarioActual) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    if (!ROLES_OPERATIVOS.includes(usuarioActual.rol.nombre)) {
      res
        .status(403)
        .json({ message: 'Solo se permite actualizar usuarios de rol Mesero o Cocina' });
      return;
    }

    // Verificar si el nuevo teléfono o código ya los tiene otra persona
    if (telefono || codigoEmpleado) {
      const conflicto = await prisma.user.findFirst({
        where: {
          AND: [{ id: { not: id } }, { OR: [{ telefono }, { codigoEmpleado }] }],
        },
      });

      if (conflicto) {
        const campo = conflicto.telefono === telefono ? 'teléfono' : 'código de empleado';
        res.status(409).json({ message: `El ${campo} ya pertenece a otro usuario` });
        return;
      }
    }

    const datosActualizacion: Prisma.UserUncheckedUpdateInput = {};
    if (nombre) datosActualizacion.nombre = nombre;
    if (apellido) datosActualizacion.apellido = apellido;
    if (telefono) datosActualizacion.telefono = telefono;
    if (codigoEmpleado) datosActualizacion.codigoEmpleado = codigoEmpleado;
    if (typeof estaActivo === 'boolean') datosActualizacion.estaActivo = estaActivo;

    if (pin) {
      if (!/^\d{4}$/.test(pin)) {
        res.status(400).json({ message: 'El PIN debe ser exactamente de 4 dígitos numéricos' });
        return;
      }
      datosActualizacion.pinHash = await bcrypt.hash(pin, 10);
    }

    if (rolNombre) {
      if (!ROLES_OPERATIVOS.includes(rolNombre)) {
        res.status(400).json({ message: `El rol solo puede ser: ${ROLES_OPERATIVOS.join(', ')}` });
        return;
      }
      const nuevoRol = await prisma.role.findUnique({ where: { nombre: rolNombre } });
      if (!nuevoRol) {
        res.status(404).json({ message: `El rol '${rolNombre}' no existe` });
        return;
      }
      datosActualizacion.rolId = nuevoRol.id;
    }

    const usuarioActualizado = await prisma.user.update({
      where: { id },
      data: datosActualizacion,
      select: {
        id: true,
        nombre: true,
        apellido: true,
        telefono: true,
        codigoEmpleado: true,
        estaActivo: true,
        rol: { select: { nombre: true } },
        actualizadoEn: true,
      },
    });

    res
      .status(200)
      .json({ message: 'Personal actualizado correctamente', usuario: usuarioActualizado });
  } catch (error) {
    console.error('Error al actualizar personal:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// 4. ELIMINAR / DESACTIVAR PERSONAL OPERATIVO
export const eliminarPersonal = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El ID debe ser un texto válido' });
      return;
    }

    const usuario = await prisma.user.findUnique({
      where: { id },
      include: { rol: true },
    });

    if (!usuario) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    if (!ROLES_OPERATIVOS.includes(usuario.rol.nombre)) {
      res.status(403).json({ message: 'Solo se permite eliminar cuentas de personal operativo' });
      return;
    }

    try {
      // Intentar borrado físico
      await prisma.user.delete({ where: { id } });
      res.status(200).json({ message: 'Usuario eliminado permanentemente de la base de datos' });
    } catch (dbError) {
      // Si falla por restricción de clave foránea (órdenes o auditorías asignadas), aplicar desactivación (Soft Delete)
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2003') {
        await prisma.user.update({
          where: { id },
          data: { estaActivo: false },
        });
        res.status(200).json({
          message:
            'El usuario tiene registros u órdenes vinculadas. Se ha desactivado su cuenta en lugar de borrarla.',
        });
        return;
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Error al eliminar personal:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};
