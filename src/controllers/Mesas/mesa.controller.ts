import { Request, Response } from 'express';
import prisma from '../../config/prisma';

// 1. CREAR MESA
export const crearMesa = async (req: Request, res: Response): Promise<void> => {
  try {
    const { numeroMesa, capacidad } = req.body;

    if (!numeroMesa) {
      res.status(400).json({ message: 'El campo numeroMesa es obligatorio' });
      return;
    }

    const numeroStr = String(numeroMesa).trim();

    const mesaExiste = await prisma.table.findUnique({
      where: { numeroMesa: numeroStr },
    });

    if (mesaExiste) {
      res.status(400).json({ message: `La mesa '${numeroStr}' ya existe` });
      return;
    }

    const nuevaMesa = await prisma.table.create({
      data: {
        numeroMesa: numeroStr,
        capacidad: capacidad ? Number(capacidad) : 4,
        estado: 'disponible',
      },
    });

    res.status(201).json({ message: 'Mesa creada exitosamente', mesa: nuevaMesa });
  } catch (error) {
    console.error('Error al crear mesa:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// 2. OBTENER TODAS LAS MESAS CON SUS ÓRDENES ACTIVAS
export const obtenerMesas = async (_req: Request, res: Response): Promise<void> => {
  try {
    const mesas = await prisma.table.findMany({
      orderBy: { id: 'asc' },
      include: {
        ordenes: {
          where: { estado: { notIn: ['pagado', 'cancelado'] } },
          select: {
            id: true,
            folio: true,
            estado: true,
            subtotal: true,
            total: true,
            creadoEn: true,
          },
        },
      },
    });

    res.status(200).json({ mesas });
  } catch (error) {
    console.error('Error al obtener mesas:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// 3. CAMBIAR ESTADO DE LA MESA (disponible, ocupada, reservada, mantenimiento)
export const cambiarEstadoMesa = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const estadosValidos = ['disponible', 'ocupada', 'reservada', 'mantenimiento'];
    if (!estado || !estadosValidos.includes(estado.toLowerCase())) {
      res.status(400).json({ message: `Estado no válido. Opciones: ${estadosValidos.join(', ')}` });
      return;
    }

    const mesaId = Number(id);
    if (isNaN(mesaId)) {
      res.status(400).json({ message: 'ID de mesa inválido' });
      return;
    }

    const mesaActualizada = await prisma.table.update({
      where: { id: mesaId },
      data: { estado: estado.toLowerCase() },
    });

    res.status(200).json({ message: 'Estado de mesa actualizado', mesa: mesaActualizada });
  } catch (error) {
    console.error('Error al cambiar estado de mesa:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};