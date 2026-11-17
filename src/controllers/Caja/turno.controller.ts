import { Request, Response } from 'express';
import prisma from '../../config/prisma';

interface AuthRequest extends Request {
  usuario?: {
    id: string;
    rol: string;
    nombre?: string;
  };
}

/**
 * Calcula los totales financieros reales de un turno en curso o cerrado.
 * Descuenta el cambio devuelto al cliente para saber el efectivo neto exacto en gaveta.
 */
async function calcularResumenTurno(turnoId: string) {
  const turno = await prisma.turnoCaja.findUnique({
    where: { id: turnoId },
    include: {
      usuario: { select: { id: true, nombre: true, correoElectronico: true } },
      asignadoPor: { select: { id: true, nombre: true } },
      movimientos: { orderBy: { creadoEn: 'desc' } },
      pagos: {
        include: {
          orden: {
            select: { id: true, folio: true, total: true, estado: true },
          },
        },
      },
    },
  });

  if (!turno) return null;

  // Agrupar pagos por orden para descontar cambio dado en efectivo
  const ordenesMap = new Map<
    string,
    {
      totalOrden: number;
      efectivoBruto: number;
      tarjeta: number;
      transferencia: number;
    }
  >();

  for (const p of turno.pagos) {
    if (p.orden?.estado === 'cancelado') continue;

    const actual = ordenesMap.get(p.ordenId) || {
      totalOrden: Number(p.orden?.total || 0),
      efectivoBruto: 0,
      tarjeta: 0,
      transferencia: 0,
    };

    const metodo = String(p.metodoPago || '').toLowerCase();
    const monto = Number(p.monto || 0);

    if (metodo === 'efectivo') {
      actual.efectivoBruto += monto;
    } else if (metodo === 'tarjeta') {
      actual.tarjeta += monto;
    } else {
      actual.transferencia += monto;
    }

    ordenesMap.set(p.ordenId, actual);
  }

  let ventasEfectivoNeto = 0;
  let ventasTarjeta = 0;
  let ventasTransferencia = 0;

  for (const ord of ordenesMap.values()) {
    ventasTarjeta += ord.tarjeta;
    ventasTransferencia += ord.transferencia;
    // El efectivo real que se queda en gaveta es el restante cubierto en efectivo
    const restanteEnEfectivo = Math.max(
      0,
      ord.totalOrden - ord.tarjeta - ord.transferencia,
    );
    ventasEfectivoNeto += Math.min(ord.efectivoBruto, restanteEnEfectivo);
  }

  let ingresosExtra = 0;
  let retirosYGastos = 0;

  for (const mov of turno.movimientos) {
    const monto = Number(mov.monto || 0);
    if (mov.tipo === 'INGRESO_FONDO') {
      ingresosExtra += monto;
    } else {
      retirosYGastos += monto;
    }
  }

  const fondoInicial = Number(turno.fondoInicial || 0);
  const efectivoEnGavetaEsperado = Number(
    (fondoInicial + ventasEfectivoNeto + ingresosExtra - retirosYGastos).toFixed(2),
  );
  const totalRecaudadoVentas = Number(
    (ventasEfectivoNeto + ventasTarjeta + ventasTransferencia).toFixed(2),
  );

  return {
    id: turno.id,
    usuario: turno.usuario,
    asignadoPor: turno.asignadoPor,
    estado: turno.estado,
    abiertoEn: turno.abiertoEn,
    cerradoEn: turno.cerradoEn,
    fondoInicial: Number(fondoInicial.toFixed(2)),
    ventasEfectivo: Number(ventasEfectivoNeto.toFixed(2)),
    ventasTarjeta: Number(ventasTarjeta.toFixed(2)),
    ventasTransferencia: Number(ventasTransferencia.toFixed(2)),
    totalRecaudadoVentas,
    ingresosExtra: Number(ingresosExtra.toFixed(2)),
    retirosYGastos: Number(retirosYGastos.toFixed(2)),
    efectivoEnGavetaEsperado,
    efectivoContado:
      turno.efectivoContado !== null ? Number(turno.efectivoContado) : null,
    diferencia: turno.diferencia !== null ? Number(turno.diferencia) : null,
    notasCierre: turno.notasCierre,
    ordenesCobradasCount: ordenesMap.size,
    movimientos: turno.movimientos.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      monto: Number(m.monto),
      concepto: m.concepto,
      creadoEn: m.creadoEn,
    })),
  };
}

// 1. Abrir turno o asignar fondo inicial a un mesero (Admin o Mesero)
export const abrirOAsignarTurno = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const solicitante = req.usuario;
    if (!solicitante) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    const { usuarioId, fondoInicial } = req.body as {
      usuarioId?: string;
      fondoInicial?: number;
    };

    const targetUsuarioId =
      solicitante.rol === 'Admin' && usuarioId ? usuarioId : solicitante.id;

    const fondoNum = Number(fondoInicial ?? 0);
    if (isNaN(fondoNum) || fondoNum < 0) {
      res.status(400).json({ message: 'El fondo inicial debe ser $0.00 o mayor.' });
      return;
    }

    const turnoExistente = await prisma.turnoCaja.findFirst({
      where: {
        usuarioId: targetUsuarioId,
        estado: 'abierto',
      },
    });

    if (turnoExistente) {
      res.status(400).json({
        message: 'Este usuario ya tiene un turno abierto activo.',
      });
      return;
    }

    const nuevoTurno = await prisma.turnoCaja.create({
      data: {
        usuarioId: targetUsuarioId,
        asignadoPorId: solicitante.id,
        fondoInicial: fondoNum,
        estado: 'abierto',
      },
    });

    const resumen = await calcularResumenTurno(nuevoTurno.id);

    const io = req.app.get('io');
    if (io) {
      io.emit('caja:actualizada', {
        tipo: 'TURNO_ABIERTO',
        turnoId: nuevoTurno.id,
        usuarioId: targetUsuarioId,
      });
    }

    res.status(201).json({
      message: `Turno abierto con fondo inicial de $${fondoNum.toFixed(2)}`,
      turno: resumen,
    });
  } catch (error) {
    console.error('Error al abrir turno:', error);
    res.status(500).json({ message: 'Error interno al abrir el turno de caja.' });
  }
};

// 2. Consultar el turno activo del usuario autenticado (Mesero/Admin en POS)
export const obtenerMiTurnoActivo = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const usuarioId = req.usuario?.id;
    if (!usuarioId) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    const turnoActivo = await prisma.turnoCaja.findFirst({
      where: { usuarioId, estado: 'abierto' },
      orderBy: { abiertoEn: 'desc' },
    });

    if (!turnoActivo) {
      res.status(200).json({ turno: null });
      return;
    }

    const resumen = await calcularResumenTurno(turnoActivo.id);
    res.status(200).json({ turno: resumen });
  } catch (error) {
    console.error('Error al obtener turno activo:', error);
    res.status(500).json({ message: 'Error al consultar turno activo.' });
  }
};

// 3. Registrar movimiento de caja (Retiro, Gasto menor o Ingreso de cambio)
export const registrarMovimientoCaja = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const turnoId = String(req.params.turnoId);
    const { tipo, monto, concepto } = req.body as {
      tipo?: 'INGRESO_FONDO' | 'RETIRO' | 'GASTO';
      monto?: number;
      concepto?: string;
    };

    const montoNum = Number(monto || 0);
    if (!tipo || !['INGRESO_FONDO', 'RETIRO', 'GASTO'].includes(tipo)) {
      res.status(400).json({ message: 'Tipo de movimiento inválido.' });
      return;
    }

    if (isNaN(montoNum) || montoNum <= 0) {
      res.status(400).json({ message: 'El monto debe ser mayor a $0.00.' });
      return;
    }

    if (!concepto || concepto.trim().length < 3) {
      res.status(400).json({ message: 'Ingresa un concepto descriptivo.' });
      return;
    }

    const turno = await prisma.turnoCaja.findUnique({ where: { id: turnoId } });
    if (!turno || turno.estado !== 'abierto') {
      res.status(400).json({ message: 'El turno no existe o ya fue cerrado.' });
      return;
    }

    await prisma.movimientoCaja.create({
      data: {
        turnoId,
        tipo,
        monto: montoNum,
        concepto: concepto.trim(),
        autorizadoPorId: req.usuario?.id,
      },
    });

    const resumen = await calcularResumenTurno(turnoId);

    const io = req.app.get('io');
    if (io) {
      io.emit('caja:actualizada', {
        tipo: 'MOVIMIENTO_CAJA',
        turnoId,
        usuarioId: turno.usuarioId,
      });
    }

    res.status(201).json({
      message: 'Movimiento registrado correctamente',
      turno: resumen,
    });
  } catch (error) {
    console.error('Error al registrar movimiento de caja:', error);
    res.status(500).json({ message: 'Error interno al registrar movimiento.' });
  }
};

// 4. Cerrar turno y realizar arqueo final (Corte de Caja)
export const cerrarTurnoCaja = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const turnoId = String(req.params.turnoId);
    const { efectivoContado, notasCierre } = req.body as {
      efectivoContado?: number;
      notasCierre?: string;
    };

    const contadoNum = Number(efectivoContado);
    if (isNaN(contadoNum) || contadoNum < 0) {
      res.status(400).json({
        message: 'Debes ingresar el monto físico contado en efectivo.',
      });
      return;
    }

    const resumenPrevio = await calcularResumenTurno(turnoId);
    if (!resumenPrevio || resumenPrevio.estado !== 'abierto') {
      res.status(400).json({ message: 'El turno no existe o ya está cerrado.' });
      return;
    }

    // Validar que el mesero no tenga órdenes abiertas asignadas sin cobrar (opcional advertencia)
    const esperado = resumenPrevio.efectivoEnGavetaEsperado;
    const diferencia = Number((contadoNum - esperado).toFixed(2));

    await prisma.turnoCaja.update({
      where: { id: turnoId },
      data: {
        estado: 'cerrado',
        cerradoEn: new Date(),
        efectivoEsperado: esperado,
        efectivoContado: contadoNum,
        diferencia,
        totalVentasEfectivo: resumenPrevio.ventasEfectivo,
        totalVentasTarjeta: resumenPrevio.ventasTarjeta,
        totalVentasTransferencia: resumenPrevio.ventasTransferencia,
        notasCierre: notasCierre?.trim() || null,
      },
    });

    const resumenFinal = await calcularResumenTurno(turnoId);

    const io = req.app.get('io');
    if (io) {
      io.emit('caja:actualizada', {
        tipo: 'TURNO_CERRADO',
        turnoId,
        usuarioId: resumenPrevio.usuario.id,
      });
    }

    res.status(200).json({
      message: 'Corte de caja realizado y turno cerrado correctamente.',
      corte: resumenFinal,
    });
  } catch (error) {
    console.error('Error al cerrar turno de caja:', error);
    res.status(500).json({ message: 'Error interno al cerrar el turno.' });
  }
};

// 5. Monitoreo en tiempo real para el Administrador
export const obtenerMonitoreoTurnosAdmin = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);

    const [turnosAbiertosRaw, turnosCerradosHoyRaw, meseros] = await Promise.all([
      prisma.turnoCaja.findMany({
        where: { estado: 'abierto' },
        orderBy: { abiertoEn: 'asc' },
      }),
      prisma.turnoCaja.findMany({
        where: {
          estado: 'cerrado',
          cerradoEn: { gte: inicioDia },
        },
        orderBy: { cerradoEn: 'desc' },
      }),
      prisma.user.findMany({
        where: {
          rol: {
            nombre: { in: ['Mesero', 'Cajero', 'Admin'] },
          },
          estaActivo: true,
        },
        select: {
          id: true,
          nombre: true,
          rol: { select: { nombre: true } },
        },
        orderBy: { nombre: 'asc' },
      }),
    ]);

    const turnosAbiertos = (
      await Promise.all(turnosAbiertosRaw.map((t) => calcularResumenTurno(t.id)))
    ).filter(Boolean);

    const turnosCerradosHoy = (
      await Promise.all(turnosCerradosHoyRaw.map((t) => calcularResumenTurno(t.id)))
    ).filter(Boolean);

    const idsConTurnoAbierto = new Set(turnosAbiertosRaw.map((t) => t.usuarioId));
    const personalSinTurno = meseros
      .filter((m) => !idsConTurnoAbierto.has(m.id))
      .map((m) => ({
        ...m,
        rol: m.rol?.nombre ?? null,
      }));

    // Totales consolidados de todos los turnos activos en este momento
    const resumenGlobalActivo = turnosAbiertos.reduce(
      (acc, t: any) => {
        acc.fondosAsignados += t.fondoInicial;
        acc.ventasEfectivo += t.ventasEfectivo;
        acc.ventasTarjeta += t.ventasTarjeta;
        acc.ventasTransferencia += t.ventasTransferencia;
        acc.efectivoEnGavetas += t.efectivoEnGavetaEsperado;
        return acc;
      },
      {
        fondosAsignados: 0,
        ventasEfectivo: 0,
        ventasTarjeta: 0,
        ventasTransferencia: 0,
        efectivoEnGavetas: 0,
      },
    );

    res.status(200).json({
      resumenGlobalActivo,
      turnosAbiertos,
      turnosCerradosHoy,
      personalSinTurno,
    });
  } catch (error) {
    console.error('Error en monitoreo de turnos admin:', error);
    res.status(500).json({ message: 'Error al obtener monitoreo de cajas.' });
  }
};