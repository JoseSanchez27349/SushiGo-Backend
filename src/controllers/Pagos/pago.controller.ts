import { Request, Response } from 'express';
import prisma from '../../config/prisma';

const METODOS_PAGO_VALIDOS = ['efectivo', 'tarjeta', 'transferencia'] as const;

type PagoInput = {
  metodoPago: (typeof METODOS_PAGO_VALIDOS)[number];
  monto: number;
  idTransaccion?: string;
};

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
export const registrarPagoOrden = async (req: Request, res: Response): Promise<void> => {
  try {
    const ordenId = req.params.ordenId;
    const usuarioCajeroId = req.usuario?.id;

    if (typeof ordenId !== 'string' || !ordenId.trim()) {
      res.status(400).json({ message: 'El ID de la orden es requerido' });
      return;
    }

    const pagos = validarPagos(req.body?.pagos);
    if (!pagos) {
      res.status(400).json({
        message:
          'Debe enviar pagos con método válido (efectivo, tarjeta o transferencia) y monto mayor a 0',
      });
      return;
    }

    const idLimpio = ordenId.trim();

    const orden = await prisma.order.findUnique({
      where: { id: idLimpio },
      include: {
        mesa: true,
        usuario: true,
        pagos: true,
      },
    });

    if (!orden) {
      res.status(404).json({ message: 'Orden no encontrada' });
      return;
    }

    if (orden.estado === 'pagado') {
      res.status(400).json({ message: 'Esta orden ya ha sido pagada previamente' });
      return;
    }

    if (orden.estado === 'cancelado') {
      res.status(400).json({ message: 'No se puede procesar el pago de una orden cancelada' });
      return;
    }

    const montoTotalAbonado = Number(pagos.reduce((acc, item) => acc + item.monto, 0).toFixed(2));

    const totalOrden = Number(orden.total);

    if (montoTotalAbonado < totalOrden) {
      res.status(400).json({
        message: `El monto abonado ($${montoTotalAbonado.toFixed(2)}) es menor al total de la orden ($${totalOrden.toFixed(2)})`,
      });
      return;
    }

    const cambioOdevuelto = montoTotalAbonado - totalOrden;

    // Transacción atómica: Pagos + Orden + Mesa + Puntos
    const resultado = await prisma.$transaction(async (tx) => {
      // A. Guardar los pagos realizados en Payment
      const registrosPagos = [];
      for (const p of pagos) {
        const nuevoPago = await tx.payment.create({
          data: {
            ordenId: idLimpio,
            metodoPago: p.metodoPago,
            monto: p.monto,
            estado: 'pagado',
            idTransaccion: p.idTransaccion || null,
            pagadoEn: new Date(),
          },
        });
        registrosPagos.push(nuevoPago);
      }

      // B. Cambiar estado de la Orden
      const ordenActualizada = await tx.order.update({
        where: { id: idLimpio },
        data: {
          estado: 'pagado',
          impresoCuenta: true,
        },
      });

      // C. Liberar la Mesa automáticamente
      if (orden.mesaId) {
        await tx.table.update({
          where: { id: orden.mesaId },
          data: { estado: 'disponible' },
        });
      }

      // D. Otorgar Puntos de Lealtad al cliente ($10 MXN = 1 Punto)
      let puntosOtorgados = 0;
      if (orden.usuarioId) {
        puntosOtorgados = Math.floor(totalOrden / 10);

        if (puntosOtorgados > 0) {
          await tx.user.update({
            where: { id: orden.usuarioId },
            data: {
              puntosAcumulados: {
                increment: puntosOtorgados,
              },
            },
          });

          await tx.pointsHistory.create({
            data: {
              usuarioId: orden.usuarioId,
              ordenId: idLimpio,
              registradoPorId: usuarioCajeroId || null,
              tipoMovimiento: 'ACUMULACION_VENTA',
              puntos: puntosOtorgados,
              descripcion: `Puntos por compra del Folio #${orden.folio} ($${totalOrden.toFixed(2)})`,
            },
          });
        }
      }

      return {
        orden: ordenActualizada,
        pagos: registrosPagos,
        puntosOtorgados,
      };
    });

    res.status(200).json({
      message: 'Pago procesado exitosamente. Orden saldada y mesa liberada.',
      folio: orden.folio,
      totalOrden,
      montoAbonado: montoTotalAbonado,
      cambio: Number(cambioOdevuelto.toFixed(2)),
      puntosAcumulados: resultado.puntosOtorgados,
      detallesPago: resultado.pagos,
    });
  } catch (error) {
    console.error('Error al procesar pago:', error);
    res.status(500).json({ message: 'Error interno al registrar el pago' });
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
