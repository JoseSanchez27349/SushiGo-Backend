import { Request, Response } from 'express';
import prisma from '../../config/prisma';

const METODOS_PAGO_VALIDOS = ['efectivo', 'tarjeta', 'transferencia'] as const;

type PagoInput = {
  metodoPago: (typeof METODOS_PAGO_VALIDOS)[number];
  monto: number;
  idTransaccion?: string;
};

interface AuthRequest extends Request {
  user?: {
    id: string;
    rol: string;
    nombre?: string;
  };
}

const validarPagos = (pagos: unknown): PagoInput[] | null => {
  if (!Array.isArray(pagos) || pagos.length === 0) {
    return null;
  }

  const pagosValidados: PagoInput[] = [];
  for (const pago of pagos) {
    if (typeof pago !== 'object' || pago === null || Array.isArray(pago)) {
      return null;
    }

    const item = pago as Record<string, unknown>;
    if (typeof item.metodoPago !== 'string') {
      return null;
    }

    const metodoPago = item.metodoPago.toLowerCase();
    if (!METODOS_PAGO_VALIDOS.includes(metodoPago as PagoInput['metodoPago'])) {
      return null;
    }

    const monto = Number(item.monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      return null;
    }

    if (item.idTransaccion !== undefined && typeof item.idTransaccion !== 'string') {
      return null;
    }

    pagosValidados.push({
      metodoPago: metodoPago as PagoInput['metodoPago'],
      monto,
      ...(typeof item.idTransaccion === 'string' ? { idTransaccion: item.idTransaccion } : {}),
    });
  }

  return pagosValidados;
};

// 1. REGISTRAR PAGO (Cobro individual o mixto, Cierre de Orden y Puntos)
export const registrarPagoOrden = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const ordenId = Array.isArray(req.params.ordenId)
      ? req.params.ordenId[0]
      : req.params.ordenId;

    const { pagos } = req.body as { pagos?: PagoInput[] };

    if (!ordenId || !Array.isArray(pagos) || pagos.length === 0) {
      res.status(400).json({
        message: 'Debes indicar la orden y al menos una forma de pago válida.',
      });
      return;
    }

    const orden = await prisma.order.findUnique({
      where: { id: ordenId },
      include: { mesa: true },
    });

    if (!orden) {
      res.status(404).json({ message: 'La orden especificada no existe.' });
      return;
    }

    if (orden.estado === 'pagado') {
      res.status(400).json({ message: 'Esta orden ya fue cobrada anteriormente.' });
      return;
    }

    if (orden.estado === 'cancelado') {
      res.status(400).json({ message: 'No se puede cobrar una orden cancelada.' });
      return;
    }

    const totalOrden = Number(orden.total || 0);
    const pagosValidos = pagos.filter((p) => Number(p.monto) > 0);

    if (pagosValidos.length === 0) {
      res.status(400).json({ message: 'El monto del pago debe ser mayor a $0.00.' });
      return;
    }

    const montoAbonado = Number(
      pagosValidos.reduce((acc, p) => acc + Number(p.monto), 0).toFixed(2),
    );

    if (montoAbonado + 0.01 < totalOrden) {
      res.status(400).json({
        message: `Monto insuficiente. Faltan $${(totalOrden - montoAbonado).toFixed(2)} por cubrir.`,
      });
      return;
    }

    const cambio = Math.max(0, Number((montoAbonado - totalOrden).toFixed(2)));
    const ahora = new Date();

    // Buscar el turno abierto del usuario que cobra (o del mesero que abrió la orden)
    const cobradorId = req.user?.id || orden.usuarioId || null;
    const turnoActivo = cobradorId
      ? await prisma.turnoCaja.findFirst({
          where: {
            usuarioId: cobradorId,
            estado: 'abierto',
          },
          orderBy: { abiertoEn: 'desc' },
        })
      : null;

    await prisma.$transaction(async (tx) => {
      // 1. Registrar cada línea de pago vinculada al turno activo
      for (const p of pagosValidos) {
        await tx.payment.create({
          data: {
            ordenId: orden.id,
            metodoPago: p.metodoPago,
            monto: Number(p.monto),
            idTransaccion: p.idTransaccion?.trim() || null,
            turnoId: turnoActivo?.id || null,
            cobradoPorId: cobradorId,
          },
        });
      }

      // 2. Marcar la orden como pagada
      await tx.order.update({
        where: { id: orden.id },
        data: { estado: 'pagado' },
      });

      // 3. Cerrar pendientes en cocina si se cobró por adelantado
      await tx.kitchenTime.updateMany({
        where: {
          ordenId: orden.id,
          estadoCocina: { not: 'listo' },
        },
        data: {
          estadoCocina: 'listo',
          listoEn: ahora,
        },
      });

      await tx.orderItem.updateMany({
        where: {
          ordenId: orden.id,
          estadoCocina: { notIn: ['listo', 'cancelado'] },
        },
        data: {
          estadoCocina: 'listo',
          listoEn: ahora,
        },
      });

      // 4. Liberar la mesa si no tiene otras cuentas activas
      if (orden.mesaId) {
        const otrasCuentasActivas = await tx.order.count({
          where: {
            mesaId: orden.mesaId,
            id: { not: orden.id },
            estado: { notIn: ['pagado', 'cancelado'] },
          },
        });

        if (otrasCuentasActivas === 0) {
          await tx.table.update({
            where: { id: orden.mesaId },
            data: { estado: 'disponible' },
          });
        }
      }
    });

    // 5. Notificar en tiempo real a POS, Cocina, Admin y Monitor de Cajas
    const io = req.app.get('io');
    if (io) {
      io.emit('pos:orden-actualizada', {
        ordenId: orden.id,
        estado: 'pagado',
        ordenCompletaLista: false,
      });
      io.emit('caja:actualizada', {
        tipo: 'PAGO_REGISTRADO',
        ordenId: orden.id,
        turnoId: turnoActivo?.id || null,
        usuarioId: cobradorId,
      });
    }

    res.status(201).json({
      message: 'Pago registrado y cuenta cerrada correctamente',
      folio: orden.folio,
      totalOrden,
      montoAbonado,
      cambio,
      puntosAcumulados: 0,
      turnoVinculado: Boolean(turnoActivo),
    });
  } catch (error) {
    console.error('Error al registrar pago de la orden:', error);
    res.status(500).json({ message: 'Error interno al registrar el pago.' });
  }
};

// 2. REGISTRO Y AUDITORÍA DE REIMPRESIÓN DE TICKETS
export const solicitarReimpresion = async (req: Request, res: Response): Promise<void> => {
  try {
    const ordenId = req.params.ordenId;
    const { tipoTicket } = req.body; // 'precuenta' | 'ticket_final' | 'cocina'
    const usuarioSolicitanteId = req.usuario?.id;

    if (typeof ordenId !== 'string' || !ordenId.trim()) {
      res.status(400).json({ message: 'El ID de la orden es requerido' });
      return;
    }

    if (!usuarioSolicitanteId) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    const tiposValidos = ['precuenta', 'ticket_final', 'cocina'];
    if (typeof tipoTicket !== 'string' || !tiposValidos.includes(tipoTicket.toLowerCase())) {
      res
        .status(400)
        .json({ message: `Tipo de ticket inválido. Opciones: ${tiposValidos.join(', ')}` });
      return;
    }
    const tipoTicketLimpio = tipoTicket.toLowerCase();

    const orden = await prisma.order.findUnique({
      where: { id: ordenId.trim() },
      include: {
        mesa: true,
        detalles: { include: { producto: true } },
        pagos: true,
      },
    });

    if (!orden) {
      res.status(404).json({ message: 'Orden no encontrada' });
      return;
    }

    const registroAuditoria = await prisma.reprintHistory.create({
      data: {
        ordenId: orden.id,
        solicitadoPorId: usuarioSolicitanteId,
        tipoTicket: tipoTicketLimpio,
      },
    });

    if (tipoTicketLimpio === 'precuenta') {
      await prisma.order.update({
        where: { id: orden.id },
        data: { impresoCuenta: true },
      });
    }

    res.status(200).json({
      message: `Reimpresión de ${tipoTicketLimpio} autorizada y registrada en auditoría`,
      auditoriaId: registroAuditoria.id,
      ticketData: {
        folio: orden.folio,
        tipoOrden: orden.tipoOrden,
        mesa: orden.mesa?.numeroMesa || 'N/A',
        total: orden.total,
        detalles: orden.detalles,
        pagos: orden.pagos,
        reimpresoEn: registroAuditoria.creadoEn,
      },
    });
  } catch (error) {
    console.error('Error al solicitar reimpresión:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// 3. CONSULTAR DETALLE DE PAGO Y HISTORIAL DE LA ÓRDEN
export const obtenerDetallePagoOrden = async (req: Request, res: Response): Promise<void> => {
  try {
    const ordenId = req.params.ordenId;
    if (typeof ordenId !== 'string' || !ordenId.trim()) {
      res.status(400).json({ message: 'El ID de la orden es requerido' });
      return;
    }

    const orden = await prisma.order.findUnique({
      where: { id: ordenId.trim() },
      include: {
        mesa: true,
        usuario: { select: { id: true, nombre: true, apellido: true, puntosAcumulados: true } },
        pagos: true,
        historialPuntos: true,
        historialReimpresiones: {
          include: { solicitadoPor: { select: { nombre: true, apellido: true } } },
        },
      },
    });

    if (!orden) {
      res.status(404).json({ message: 'Orden no encontrada' });
      return;
    }

    res.status(200).json({ orden });
  } catch (error) {
    console.error('Error al consultar pago de orden:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};
