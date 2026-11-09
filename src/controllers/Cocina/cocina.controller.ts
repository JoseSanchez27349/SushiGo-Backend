import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../config/prisma';

type NivelAlerta = 'normal' | 'advertencia' | 'critico';

export const calcularContadorEnVivo = (
  tiempoEstimadoMinutos: number,
  inicioPreparacionEn: Date | null,
  ahora = Date.now(),
): {
  minutosTranscurridos: number;
  minutosRestantes: number;
  tiempoEstimadoMinutos: number;
  estaRetrasada: boolean;
  nivelAlerta: NivelAlerta;
} => {
  const minutosTranscurridos = inicioPreparacionEn
    ? Math.max(0, Math.floor((ahora - inicioPreparacionEn.getTime()) / 60_000))
    : 0;
  const minutosRestantes = Math.max(0, tiempoEstimadoMinutos - minutosTranscurridos);
  const estaRetrasada = minutosTranscurridos > tiempoEstimadoMinutos;

  return {
    minutosTranscurridos,
    minutosRestantes,
    tiempoEstimadoMinutos,
    estaRetrasada,
    nivelAlerta: estaRetrasada ? 'critico' : minutosTranscurridos >= 10 ? 'advertencia' : 'normal',
  };
};

// 1. OBTENER COMANDAS EN PANTALLA DE COCINA
export const obtenerComandasCocina = async (_req: Request, res: Response): Promise<void> => {
  try {
    const comandas = await prisma.kitchenTime.findMany({
      where: {
        estadoCocina: { in: ['en_espera', 'en_preparacion'] },
      },
      include: {
        orden: {
          include: {
            mesa: true,
            detalles: {
              include: { producto: true },
            },
          },
        },
        cocinero: {
          select: { id: true, nombre: true, apellido: true },
        },
      },
      orderBy: { creadoEn: 'asc' }, // Las más antiguas primero
    });

    const comandasConContador = comandas.map((comanda) => ({
      ...comanda,
      contadorEnVivo: calcularContadorEnVivo(
        comanda.tiempoEstimadoMinutos,
        comanda.inicioPreparacionEn,
      ),
    }));

    res.status(200).json({ comandas: comandasConContador });
  } catch (error) {
    console.error('Error al obtener comandas de cocina:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// 2. CAMBIAR ESTADO DE COCINA (en_espera -> en_preparacion -> listo)
export const cambiarEstadoCocina = async (req: Request, res: Response): Promise<void> => {
  try {
    const ordenId = req.params.ordenId;
    const { estadoCocina } = req.body;
    const cocineroId = req.usuario?.id;

    if (typeof ordenId !== 'string') {
      res.status(400).json({ message: 'El ID de la orden debe ser un texto válido' });
      return;
    }

    if (typeof estadoCocina !== 'string') {
      res.status(400).json({ message: 'Debe proporcionar un estado de cocina válido' });
      return;
    }

    const estadosValidos = ['en_espera', 'en_preparacion', 'listo'];
    if (!estadoCocina || !estadosValidos.includes(estadoCocina.toLowerCase())) {
      res.status(400).json({ message: `Estado inválido. Opciones: ${estadosValidos.join(', ')}` });
      return;
    }

    const estadoLimpio = estadoCocina.toLowerCase();

    const tiempoCocinaExiste = await prisma.kitchenTime.findUnique({
      where: { ordenId: ordenId.trim() },
    });

    if (!tiempoCocinaExiste) {
      res.status(404).json({ message: 'Registro de cocina no encontrado para esta orden' });
      return;
    }

    const datosActualizacion: Prisma.KitchenTimeUncheckedUpdateInput = {
      estadoCocina: estadoLimpio,
      cocineroId: cocineroId || tiempoCocinaExiste.cocineroId,
    };

    if (estadoLimpio === 'en_preparacion' && !tiempoCocinaExiste.inicioPreparacionEn) {
      datosActualizacion.inicioPreparacionEn = new Date();
    }

    if (estadoLimpio === 'listo') {
      datosActualizacion.listoEn = new Date();
    }

    // Actualizar tiempos de cocina y estado global de la orden
    const [tiempoActualizado] = await prisma.$transaction([
      prisma.kitchenTime.update({
        where: { ordenId: ordenId.trim() },
        data: datosActualizacion,
      }),
      prisma.order.update({
        where: { id: ordenId.trim() },
        data: { estado: estadoLimpio === 'listo' ? 'preparado' : estadoLimpio },
      }),
    ]);

    res.status(200).json({
      message: 'Estado de comanda actualizado en cocina',
      cocina: tiempoActualizado,
      contadorEnVivo: calcularContadorEnVivo(
        tiempoActualizado.tiempoEstimadoMinutos,
        tiempoActualizado.inicioPreparacionEn,
      ),
    });
  } catch (error) {
    console.error('Error al actualizar estado en cocina:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};
