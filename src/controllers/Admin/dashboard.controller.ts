import { Request, Response } from 'express';
import prisma from '../../config/prisma';

export const obtenerMetricasDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const periodo = String(req.query.periodo || 'hoy').toLowerCase();

    const ahora = new Date();
    const fechaInicio = new Date(ahora);
    fechaInicio.setHours(0, 0, 0, 0);

    let diasPeriodo = 1;
    if (periodo === 'semana') {
      diasPeriodo = 7;
      fechaInicio.setDate(fechaInicio.getDate() - 6);
    } else if (periodo === 'mes') {
      diasPeriodo = 30;
      fechaInicio.setDate(fechaInicio.getDate() - 29);
    }

    // Rango equivalente del periodo anterior para calcular crecimiento (%)
    const fechaInicioAnterior = new Date(fechaInicio);
    fechaInicioAnterior.setDate(fechaInicioAnterior.getDate() - diasPeriodo);

    const [
      ordenesPeriodo,
      ordenesPeriodoAnterior,
      ordenesActivas,
      mesas,
      tiemposCocina,
      itemsCocina,
      movimientosSalida,
      ingredientes,
      pagosPeriodo,
    ] = await Promise.all([
      prisma.order.findMany({
        where: {
          creadoEn: { gte: fechaInicio },
        },
        include: {
          mesa: true,
          detalles: {
            include: { producto: true },
          },
        },
        orderBy: { creadoEn: 'asc' },
      }),
      prisma.order.findMany({
        where: {
          creadoEn: {
            gte: fechaInicioAnterior,
            lt: fechaInicio,
          },
          estado: 'pagado',
        },
        select: {
          total: true,
        },
      }),
      prisma.order.findMany({
        where: {
          estado: { notIn: ['pagado', 'cancelado'] },
        },
        select: {
          id: true,
          total: true,
          estado: true,
        },
      }),
      prisma.table.findMany({
        select: {
          id: true,
          numeroMesa: true,
          estado: true,
        },
      }),
      prisma.kitchenTime.findMany({
        where: {
          creadoEn: { gte: fechaInicio },
          listoEn: { not: null },
        },
      }),
      prisma.orderItem.findMany({
        where: {
          creadoEn: { gte: fechaInicio },
          estadoCocina: { not: 'cancelado' },
          orden: {
            estado: { not: 'cancelado' },
          },
        },
        include: {
          producto: {
            include: { categoria: true },
          },
        },
      }),
      prisma.inventoryMovement.findMany({
        where: {
          creadoEn: { gte: fechaInicio },
          tipoMovimiento: 'SALIDA_VENTA',
        },
        select: {
          costoTotal: true,
        },
      }),
      prisma.ingredient.findMany({
        orderBy: { stockActual: 'asc' },
      }),
      // Nota: Si tu modelo en schema.prisma se llama "Pago" en lugar de "Payment", cambia prisma.payment por prisma.pago
      prisma.payment.findMany({
        where: {
          creadoEn: { gte: fechaInicio },
        },
        select: {
          metodoPago: true,
          monto: true,
        },
      }),
    ]);

    // 1. Resumen de Ventas, Órdenes y Cancelaciones
    const ordenesPagadas = ordenesPeriodo.filter((o) => o.estado === 'pagado');
    const ordenesCanceladas = ordenesPeriodo.filter((o) => o.estado === 'cancelado');

    const ventasTotales = ordenesPagadas.reduce((acc, o) => acc + Number(o.total || 0), 0);
    const ticketPromedio =
      ordenesPagadas.length > 0 ? ventasTotales / ordenesPagadas.length : 0;

    const ventasPorCobrar = ordenesActivas.reduce((acc, o) => acc + Number(o.total || 0), 0);

    const montoCancelado = ordenesCanceladas.reduce((acc, o) => acc + Number(o.total || 0), 0);
    const tasaCancelacionPorcentaje =
      ordenesPeriodo.length > 0 ? (ordenesCanceladas.length / ordenesPeriodo.length) * 100 : 0;

    // 1.1 Comparativa con Periodo Anterior
    const ventasAnterior = ordenesPeriodoAnterior.reduce(
      (acc, o) => acc + Number(o.total || 0),
      0,
    );
    const ordenesAnteriorCount = ordenesPeriodoAnterior.length;
    const ticketPromedioAnterior =
      ordenesAnteriorCount > 0 ? ventasAnterior / ordenesAnteriorCount : 0;

    const calcularCrecimiento = (actual: number, anterior: number): number => {
      if (anterior <= 0) return actual > 0 ? 100 : 0;
      return Number((((actual - anterior) / anterior) * 100).toFixed(1));
    };

    const comparativa = {
      ventasAnterior: Number(ventasAnterior.toFixed(2)),
      crecimientoVentasPorcentaje: calcularCrecimiento(ventasTotales, ventasAnterior),
      ordenesAnterior: ordenesAnteriorCount,
      crecimientoOrdenesPorcentaje: calcularCrecimiento(
        ordenesPagadas.length,
        ordenesAnteriorCount,
      ),
      ticketPromedioAnterior: Number(ticketPromedioAnterior.toFixed(2)),
      crecimientoTicketPorcentaje: calcularCrecimiento(ticketPromedio, ticketPromedioAnterior),
    };

    // 2. Costo de Insumos y Margen Bruto Estimado
    const costoInsumos = movimientosSalida.reduce(
      (acc, m) => acc + Number(m.costoTotal || 0),
      0,
    );
    const margenBruto = ventasTotales - costoInsumos;
    const margenPorcentaje = ventasTotales > 0 ? (margenBruto / ventasTotales) * 100 : 0;

    // 3. Desglose Comedor vs Para Llevar y Métodos de Pago
    const comedorPagadas = ordenesPagadas.filter((o) => o.tipoOrden === 'comedor');
    const llevarPagadas = ordenesPagadas.filter((o) => o.tipoOrden !== 'comedor');

    const porCanal = {
      comedor: {
        ordenes: comedorPagadas.length,
        total: comedorPagadas.reduce((acc, o) => acc + Number(o.total || 0), 0),
      },
      llevar: {
        ordenes: llevarPagadas.length,
        total: llevarPagadas.reduce((acc, o) => acc + Number(o.total || 0), 0),
      },
    };

    const porMetodoPago = {
      efectivo: { transacciones: 0, total: 0 },
      tarjeta: { transacciones: 0, total: 0 },
      transferencia: { transacciones: 0, total: 0 },
    };

    for (const pago of pagosPeriodo) {
      const metodo = String(pago.metodoPago || '').toLowerCase();
      const monto = Number(pago.monto || 0);
      if (metodo === 'efectivo' || metodo === 'tarjeta' || metodo === 'transferencia') {
        porMetodoPago[metodo].transacciones += 1;
        porMetodoPago[metodo].total = Number((porMetodoPago[metodo].total + monto).toFixed(2));
      }
    }

    // 4. Tiempos de Cocina Globales (SLA y promedio)
    let sumaMinutosTotales = 0;
    let sumaMinutosPrep = 0;
    let countPrep = 0;
    let ordenesATiempo = 0;

    for (const kt of tiemposCocina) {
      if (!kt.listoEn) continue;
      const minTotal = Math.max(
        0,
        (kt.listoEn.getTime() - kt.creadoEn.getTime()) / 60_000,
      );
      sumaMinutosTotales += minTotal;

      if (minTotal <= (kt.tiempoEstimadoMinutos || 15)) {
        ordenesATiempo++;
      }

      if (kt.inicioPreparacionEn) {
        const minPrep = Math.max(
          0,
          (kt.listoEn.getTime() - kt.inicioPreparacionEn.getTime()) / 60_000,
        );
        sumaMinutosPrep += minPrep;
        countPrep++;
      }
    }

    const tiempoPromedioOrdenMin =
      tiemposCocina.length > 0 ? sumaMinutosTotales / tiemposCocina.length : 0;
    const tiempoPromedioFuegoMin = countPrep > 0 ? sumaMinutosPrep / countPrep : 0;
    const porcentajeATiempo =
      tiemposCocina.length > 0 ? (ordenesATiempo / tiemposCocina.length) * 100 : 100;

    // 5. Ranking de Platillos + Desglose por Categoría
    const mapaProductos = new Map<
      string,
      {
        productoId: string;
        nombre: string;
        categoria: string;
        cantidadVendida: number;
        ingresos: number;
        sumaPrepMin: number;
        sumaEsperaMin: number;
        muestrasTiempo: number;
      }
    >();

    const mapaCategorias = new Map<
      string,
      { categoria: string; cantidad: number; total: number }
    >();

    let articulosVendidosTotal = 0;

    for (const item of itemsCocina) {
      const catNombre = item.producto.categoria?.nombre || 'General';
      const itemSubtotal = Number(item.subtotal || 0);
      articulosVendidosTotal += item.cantidad;

      // Acumulado por categoría
      const catActual = mapaCategorias.get(catNombre) || {
        categoria: catNombre,
        cantidad: 0,
        total: 0,
      };
      catActual.cantidad += item.cantidad;
      catActual.total += itemSubtotal;
      mapaCategorias.set(catNombre, catActual);

      // Acumulado por producto
      const actual = mapaProductos.get(item.productoId) || {
        productoId: item.productoId,
        nombre: item.producto.nombre,
        categoria: catNombre,
        cantidadVendida: 0,
        ingresos: 0,
        sumaPrepMin: 0,
        sumaEsperaMin: 0,
        muestrasTiempo: 0,
      };

      actual.cantidadVendida += item.cantidad;
      actual.ingresos += itemSubtotal;

      if (item.listoEn) {
        const inicioRef = item.inicioPreparacionEn || item.creadoEn;
        const prepMin = Math.max(
          0,
          (item.listoEn.getTime() - inicioRef.getTime()) / 60_000,
        );
        const esperaMin = item.inicioPreparacionEn
          ? Math.max(
              0,
              (item.inicioPreparacionEn.getTime() - item.creadoEn.getTime()) / 60_000,
            )
          : 0;

        actual.sumaPrepMin += prepMin;
        actual.sumaEsperaMin += esperaMin;
        actual.muestrasTiempo++;
      }

      mapaProductos.set(item.productoId, actual);
    }

    const totalIngresosCategorias = Array.from(mapaCategorias.values()).reduce(
      (acc, c) => acc + c.total,
      0,
    );

    const ventasPorCategoria = Array.from(mapaCategorias.values())
      .map((c) => ({
        categoria: c.categoria,
        cantidad: c.cantidad,
        total: Number(c.total.toFixed(2)),
        porcentaje:
          totalIngresosCategorias > 0
            ? Number(((c.total / totalIngresosCategorias) * 100).toFixed(1))
            : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const productosAnalizados = Array.from(mapaProductos.values()).map((p) => ({
      productoId: p.productoId,
      nombre: p.nombre,
      categoria: p.categoria,
      cantidadVendida: p.cantidadVendida,
      ingresos: Number(p.ingresos.toFixed(2)),
      tiempoPromedioPrepMin:
        p.muestrasTiempo > 0 ? Number((p.sumaPrepMin / p.muestrasTiempo).toFixed(1)) : null,
      tiempoPromedioEsperaMin:
        p.muestrasTiempo > 0 ? Number((p.sumaEsperaMin / p.muestrasTiempo).toFixed(1)) : null,
      muestrasTiempo: p.muestrasTiempo,
    }));

    const topVendidos = [...productosAnalizados]
      .sort((a, b) => b.cantidadVendida - a.cantidadVendida)
      .slice(0, 6);

    const menosVendidos = [...productosAnalizados]
      .sort((a, b) => a.cantidadVendida - b.cantidadVendida)
      .slice(0, 5);

    const cuellosBotella = [...productosAnalizados]
      .filter((p) => p.tiempoPromedioPrepMin !== null && p.muestrasTiempo > 0)
      .sort((a, b) => (b.tiempoPromedioPrepMin || 0) - (a.tiempoPromedioPrepMin || 0))
      .slice(0, 6);

    // 6. Ventas por Hora (11:00 a 23:00) y Tendencia Diaria
    const ventasPorHoraMap = new Map<number, { hora: string; total: number; ordenes: number }>();
    for (let h = 11; h <= 23; h++) {
      ventasPorHoraMap.set(h, {
        hora: `${String(h).padStart(2, '0')}:00`,
        total: 0,
        ordenes: 0,
      });
    }

    const ventasPorDiaMap = new Map<string, { fecha: string; total: number; ordenes: number }>();
    for (let i = 0; i < diasPeriodo; i++) {
      const d = new Date(fechaInicio);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      ventasPorDiaMap.set(key, { fecha: key, total: 0, ordenes: 0 });
    }

    // 7. Rendimiento por Mesa
    const mapaMesas = new Map<
      number,
      { mesaId: number; numeroMesa: string; ordenes: number; total: number }
    >();

    for (const ord of ordenesPagadas) {
      const fechaOrd = new Date(ord.creadoEn);
      const totalOrd = Number(ord.total || 0);

      // Por hora
      const h = fechaOrd.getHours();
      const slotHora = ventasPorHoraMap.get(h) || {
        hora: `${String(h).padStart(2, '0')}:00`,
        total: 0,
        ordenes: 0,
      };
      slotHora.total += totalOrd;
      slotHora.ordenes += 1;
      ventasPorHoraMap.set(h, slotHora);

      // Por día
      const diaKey = fechaOrd.toISOString().slice(0, 10);
      const slotDia = ventasPorDiaMap.get(diaKey);
      if (slotDia) {
        slotDia.total = Number((slotDia.total + totalOrd).toFixed(2));
        slotDia.ordenes += 1;
      }

      // Por mesa
      if (ord.mesa) {
        const mActual = mapaMesas.get(ord.mesa.id) || {
          mesaId: ord.mesa.id,
          numeroMesa: ord.mesa.numeroMesa,
          ordenes: 0,
          total: 0,
        };
        mActual.ordenes += 1;
        mActual.total = Number((mActual.total + totalOrd).toFixed(2));
        mapaMesas.set(ord.mesa.id, mActual);
      }
    }

    const ventasPorHora = Array.from(ventasPorHoraMap.values());
    const ventasPorDia = Array.from(ventasPorDiaMap.values());
    const topMesas = Array.from(mapaMesas.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // 8. Estado de Mesas e Inventario Crítico
    const mesasOcupadas = mesas.filter((m) => m.estado === 'ocupada').length;
    const ingredientesAgotadosCount = ingredientes.filter(
      (i) => Number(i.stockActual) <= 0,
    ).length;

    res.status(200).json({
      periodo,
      comparativa,
      kpis: {
        ventasTotales: Number(ventasTotales.toFixed(2)),
        ticketPromedio: Number(ticketPromedio.toFixed(2)),
        ordenesPagadas: ordenesPagadas.length,
        ordenesCanceladas: ordenesCanceladas.length,
        montoCancelado: Number(montoCancelado.toFixed(2)),
        tasaCancelacionPorcentaje: Number(tasaCancelacionPorcentaje.toFixed(1)),
        articulosVendidosTotal,
        ordenesActivasCount: ordenesActivas.length,
        ventasPorCobrar: Number(ventasPorCobrar.toFixed(2)),
        costoInsumos: Number(costoInsumos.toFixed(2)),
        margenBruto: Number(margenBruto.toFixed(2)),
        margenPorcentaje: Number(margenPorcentaje.toFixed(1)),
        tiempoPromedioOrdenMin: Number(tiempoPromedioOrdenMin.toFixed(1)),
        tiempoPromedioFuegoMin: Number(tiempoPromedioFuegoMin.toFixed(1)),
        porcentajeATiempo: Number(porcentajeATiempo.toFixed(0)),
        mesasOcupadas,
        mesasTotal: mesas.length,
        ingredientesAgotadosCount,
      },
      porCanal,
      porMetodoPago,
      ventasPorCategoria,
      topVendidos,
      menosVendidos,
      cuellosBotella,
      topMesas,
      ventasPorHora,
      ventasPorDia,
      ingredientesMenorStock: ingredientes.slice(0, 6).map((i) => ({
        id: i.id,
        nombre: i.nombre,
        stockActual: Number(i.stockActual),
        unidadMedida: i.unidadMedida,
      })),
    });
  } catch (error) {
    console.error('Error al obtener métricas del dashboard:', error);
    res.status(500).json({ message: 'Error interno al calcular métricas del dashboard' });
  }
};