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
              orderBy: [{ ronda: 'asc' }, { creadoEn: 'asc' }],
            },
          },
        },
        cocinero: {
          select: { id: true, nombre: true, apellido: true },
        },
      },
      orderBy: { creadoEn: 'asc' },
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

// 2. CAMBIAR ESTADO DE UN PLATILLO INDIVIDUAL (OrderItem)
export const cambiarEstadoItemCocina = async (req: Request, res: Response): Promise<void> => {
  try {
    const itemId = req.params.itemId;
    const { estadoCocina } = req.body;
    const cocineroId = req.usuario?.id;

    if (typeof itemId !== 'string' || !itemId.trim()) {
      res.status(400).json({ message: 'El ID del platillo debe ser válido' });
      return;
    }

    const estadosValidos = ['en_espera', 'en_preparacion', 'listo'];
    if (typeof estadoCocina !== 'string' || !estadosValidos.includes(estadoCocina.toLowerCase())) {
      res.status(400).json({ message: `Estado inválido. Opciones: ${estadosValidos.join(', ')}` });
      return;
    }

    const estadoLimpio = estadoCocina.toLowerCase();

    const resultado = await prisma.$transaction(async (tx) => {
      const itemExistente = await tx.orderItem.findUnique({
        where: { id: itemId.trim() },
      });

      if (!itemExistente) {
        throw new Error('Platillo no encontrado en la orden');
      }

      const datosItem: Prisma.OrderItemUpdateInput = {
        estadoCocina: estadoLimpio,
      };

      if (estadoLimpio === 'en_preparacion' && !itemExistente.inicioPreparacionEn) {
        datosItem.inicioPreparacionEn = new Date();
      }

      if (estadoLimpio === 'listo') {
        datosItem.listoEn = new Date();
      } else {
        datosItem.listoEn = null;
      }

      const itemActualizado = await tx.orderItem.update({
        where: { id: itemExistente.id },
        data: datosItem,
        include: { producto: true },
      });

      // Evaluar estado global de todos los platillos de la orden
      const todosLosItems = await tx.orderItem.findMany({
        where: {
          ordenId: itemExistente.ordenId,
          estadoCocina: { not: 'cancelado' },
        },
      });

      const todosListos = todosLosItems.length > 0 && todosLosItems.every((i) => i.estadoCocina === 'listo');
      const algunoEnProcesoOListo = todosLosItems.some(
        (i) => i.estadoCocina === 'en_preparacion' || i.estadoCocina === 'listo',
      );

      const estadoCocinaGlobal = todosListos
        ? 'listo'
        : algunoEnProcesoOListo
          ? 'en_preparacion'
          : 'en_espera';

      const estadoOrdenGlobal = todosListos
        ? 'preparado'
        : algunoEnProcesoOListo
          ? 'en_preparacion'
          : 'pendiente';

      const tiempoActual = await tx.kitchenTime.findUnique({
        where: { ordenId: itemExistente.ordenId },
      });

      if (tiempoActual) {
        await tx.kitchenTime.update({
          where: { ordenId: itemExistente.ordenId },
          data: {
            estadoCocina: estadoCocinaGlobal,
            cocineroId: cocineroId || tiempoActual.cocineroId,
            inicioPreparacionEn:
              algunoEnProcesoOListo && !tiempoActual.inicioPreparacionEn
                ? new Date()
                : tiempoActual.inicioPreparacionEn,
            listoEn: todosListos ? new Date() : null,
          },
        });
      }

      await tx.order.update({
        where: { id: itemExistente.ordenId },
        data: { estado: estadoOrdenGlobal },
      });

      return {
        item: itemActualizado,
        ordenCompletaLista: todosListos,
        estadoOrdenGlobal,
      };
    });

    res.status(200).json({
      message: resultado.ordenCompletaLista
        ? 'Platillo listo y orden completa liberada para cobro'
        : 'Estado del platillo actualizado',
      ...resultado,
    });
  } catch (error) {
    console.error('Error al actualizar platillo en cocina:', error);
    if (error instanceof Error) {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// 3. CAMBIAR ESTADO DE TODA LA COMANDA EN BLOQUE (en_espera -> en_preparacion -> listo)
export const cambiarEstadoCocina = async (req: Request, res: Response): Promise<void> => {
  try {
    const ordenId = req.params.ordenId;
    const { estadoCocina } = req.body;
    const cocineroId = req.usuario?.id;

    if (typeof ordenId !== 'string') {
      res.status(400).json({ message: 'El ID de la orden debe ser un texto válido' });
      return;
    }

    const estadosValidos = ['en_espera', 'en_preparacion', 'listo'];
    if (typeof estadoCocina !== 'string' || !estadosValidos.includes(estadoCocina.toLowerCase())) {
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

    const ahora = new Date();
    const datosActualizacion: Prisma.KitchenTimeUncheckedUpdateInput = {
      estadoCocina: estadoLimpio,
      cocineroId: cocineroId || tiempoCocinaExiste.cocineroId,
    };

    if (estadoLimpio === 'en_preparacion' && !tiempoCocinaExiste.inicioPreparacionEn) {
      datosActualizacion.inicioPreparacionEn = ahora;
    }

    if (estadoLimpio === 'listo') {
      datosActualizacion.listoEn = ahora;
    } else {
      datosActualizacion.listoEn = null;
    }

    const [tiempoActualizado] = await prisma.$transaction([
      prisma.kitchenTime.update({
        where: { ordenId: ordenId.trim() },
        data: datosActualizacion,
      }),
      prisma.order.update({
        where: { id: ordenId.trim() },
        data: { estado: estadoLimpio === 'listo' ? 'preparado' : estadoLimpio },
      }),
      // Sincronizar también todos los ítems pendientes de esa orden
      prisma.orderItem.updateMany({
        where: {
          ordenId: ordenId.trim(),
          estadoCocina: { notIn: ['listo', 'cancelado'] },
        },
        data: {
          estadoCocina: estadoLimpio,
          ...(estadoLimpio === 'en_preparacion' ? { inicioPreparacionEn: ahora } : {}),
          ...(estadoLimpio === 'listo' ? { listoEn: ahora } : {}),
        },
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