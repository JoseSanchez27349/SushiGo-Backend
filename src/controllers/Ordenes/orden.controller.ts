import { Request, Response } from 'express';
import prisma from '../../config/prisma';
import { emitEvent } from '../../config/socket';

// 1. CREAR NUEVA ORDEN (POS / COMEDOR / PARA LLEVAR)
export const crearOrden = async (req: Request, res: Response): Promise<void> => {
  try {
    const meseroId = req.usuario?.id;
    const {
      items,
      tipoOrden = 'comedor',
      mesaId,
      usuarioId,
      direccionId,
      costoEnvio = 0,
      notas,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: 'Debe incluir al menos un producto en la orden' });
      return;
    }

    const tipoLimpio = String(tipoOrden).trim().toLowerCase();
    if (tipoLimpio === 'comedor' && !mesaId) {
      res.status(400).json({ message: 'Debe seleccionar una mesa para órdenes de comedor' });
      return;
    }

    const nuevaOrden = await prisma.$transaction(async (tx) => {
      if (mesaId) {
        const mesa = await tx.table.findUnique({ where: { id: Number(mesaId) } });
        if (!mesa) throw new Error('La mesa seleccionada no existe');
        if (mesa.estado === 'mantenimiento') throw new Error(`La mesa ${mesa.numeroMesa} se encuentra en mantenimiento`);
      }

      let subtotalOrden = 0;
      let tiempoTotalPreparacion = 0; // 🛠️ NUEVO: Acumulador de tiempo
      const detallesProcesados: any[] = [];
      const notasItems: string[] = [];

      for (const item of items) {
        const prodId = item.productoId?.trim();
        const cant = Number(item.cantidad);

        if (!prodId || isNaN(cant) || cant <= 0) {
          throw new Error('Cada producto debe tener un productoId válido y cantidad > 0');
        }

        const producto = await tx.product.findUnique({
          where: { id: prodId },
          include: { recetas: { include: { ingrediente: true } } },
        });

        if (!producto || !producto.estaDisponible) {
          throw new Error(`El producto '${prodId}' no existe o no está disponible`);
        }

        // 🛠️ NUEVO: Sumar tiempo estimado * cantidad
        const tiempoProducto = (producto as any).tiempoPreparacionMinutos || 15;
        tiempoTotalPreparacion += tiempoProducto * cant;

        for (const receta of producto.recetas) {
          const cantidadRequeridaTotal = Number(receta.cantidadRequerida) * cant;
          const ingrediente = receta.ingrediente;

          if (Number(ingrediente.stockActual) < cantidadRequeridaTotal) {
            throw new Error(`Stock insuficiente de '${ingrediente.nombre}'. Requerido: ${cantidadRequeridaTotal}, Disponible: ${ingrediente.stockActual}`);
          }

          await tx.ingredient.update({
            where: { id: ingrediente.id },
            data: { stockActual: { decrement: cantidadRequeridaTotal } },
          });

          await tx.inventoryMovement.create({
            data: {
              ingredienteId: ingrediente.id,
              usuarioId: meseroId || null,
              tipoMovimiento: 'SALIDA_VENTA',
              cantidad: cantidadRequeridaTotal,
              costoTotal: Number(ingrediente.costoUnitario || 0) * cantidadRequeridaTotal,
              observaciones: `Venta POS del producto '${producto.nombre}' (x${cant})`,
            },
          });
        }

        const precioUnitario = Number(producto.precio);
        const subtotalItem = precioUnitario * cant;
        subtotalOrden += subtotalItem;

        if (item.notas && String(item.notas).trim()) {
          notasItems.push(`${producto.nombre}: ${String(item.notas).trim()}`);
        }

        const yaAgregado = detallesProcesados.find((d) => d.productoId === producto.id);
        if (yaAgregado) {
          yaAgregado.cantidad += cant;
          yaAgregado.subtotal += subtotalItem;
        } else {
          detallesProcesados.push({
            productoId: producto.id,
            cantidad: cant,
            precioUnitario,
            subtotal: subtotalItem,
            estadoCocina: 'en_espera',
            ronda: 1,
          });
        }
      }

      const envioNum = Number(costoEnvio) || 0;
      const totalOrden = subtotalOrden + envioNum;

      const partesNotas: string[] = [];
      if (notas && String(notas).trim()) partesNotas.push(String(notas).trim());
      if (notasItems.length > 0) partesNotas.push(notasItems.join(' | '));
      const notasFinales = partesNotas.length > 0 ? partesNotas.join(' · ') : null;

      const ordenCreada = await tx.order.create({
        data: {
          usuarioId: usuarioId || null,
          meseroId: meseroId || null,
          mesaId: mesaId ? Number(mesaId) : null,
          direccionId: direccionId || null,
          tipoOrden: tipoLimpio,
          estado: 'pendiente',
          subtotal: subtotalOrden,
          costoEnvio: envioNum,
          total: totalOrden,
          notas: notasFinales,
          detalles: { create: detallesProcesados },
          tiemposCocina: {
            create: {
              // 🛠️ CORRECCIÓN: Usar el tiempo calculado
              tiempoEstimadoMinutos: tiempoTotalPreparacion > 0 ? tiempoTotalPreparacion : 15,
              estadoCocina: 'en_espera',
            },
          },
        },
        include: {
          detalles: {
            include: { producto: true },
            orderBy: [{ ronda: 'asc' }, { creadoEn: 'asc' }],
          },
          mesa: true,
          tiemposCocina: true,
        },
      });

      if (mesaId) {
        await tx.table.update({
          where: { id: Number(mesaId) },
          data: { estado: 'ocupada' },
        });
      }

      return ordenCreada;
    });

    emitEvent('cocina:nueva-comanda', {
      ordenId: nuevaOrden.id,
      folio: nuevaOrden.folio,
      mesa: nuevaOrden.mesa?.numeroMesa || null,
      tipoOrden: nuevaOrden.tipoOrden,
      esRondaAdicional: false,
    });

    res.status(201).json({
      message: 'Orden creada y enviada a cocina',
      orden: nuevaOrden,
    });
  } catch (error) {
    console.error('Error al crear orden:', error);
    if (error instanceof Error) {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Error interno al crear la orden' });
  }
};

// 2. OBTENER ÓRDENES ACTIVAS (CUENTAS ABIERTAS EN POS)
export const obtenerOrdenesActivas = async (_req: Request, res: Response): Promise<void> => {
  try {
    const ordenes = await prisma.order.findMany({
      where: { estado: { notIn: ['pagado', 'cancelado'] } },
      include: {
        mesa: true,
        mesero: { select: { id: true, nombre: true, apellido: true } },
        detalles: {
          include: { producto: true },
          orderBy: [{ ronda: 'asc' }, { creadoEn: 'asc' }],
        },
        tiemposCocina: true,
      },
      orderBy: { creadoEn: 'asc' },
    });

    res.status(200).json({ ordenes });
  } catch (error) {
    console.error('Error al obtener órdenes activas:', error);
    res.status(500).json({ message: 'Error interno al obtener órdenes activas' });
  }
};

// 3. AGREGAR NUEVA RONDA / PRODUCTOS A UNA ORDEN ABIERTA (SIN REINICIAR TIEMPOS)
export const agregarItemsOrden = async (req: Request, res: Response): Promise<void> => {
  try {
    const ordenId = req.params.id;
    const meseroId = req.usuario?.id;
    const { items, notas } = req.body;

    if (typeof ordenId !== 'string' || !ordenId.trim()) {
      res.status(400).json({ message: 'El ID de la orden es inválido' });
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: 'Debe incluir al menos un producto para agregar' });
      return;
    }

    const ordenActualizada = await prisma.$transaction(async (tx) => {
      const ordenExistente = await tx.order.findUnique({
        where: { id: ordenId.trim() },
        include: { detalles: true, tiemposCocina: true },
      });

      if (!ordenExistente) throw new Error('La orden especificada no existe');
      if (ordenExistente.estado === 'pagado' || ordenExistente.estado === 'cancelado') {
        throw new Error(`No se pueden agregar productos a una orden en estado '${ordenExistente.estado}'`);
      }

      const rondaActual = ordenExistente.detalles.reduce((max, d) => Math.max(max, d.ronda || 1), 1);
      const nuevaRonda = rondaActual + 1;

      let subtotalAdicional = 0;
      let tiempoRondaAdicional = 0; // 🛠️ NUEVO: Tiempo de la nueva ronda
      const detallesCrear: any[] = [];
      const resumenRonda: string[] = [];

      for (const item of items) {
        const prodId = item.productoId?.trim();
        const cant = Number(item.cantidad);

        if (!prodId || isNaN(cant) || cant <= 0) {
          throw new Error('Cada producto debe tener un productoId válido y cantidad > 0');
        }

        const producto = await tx.product.findUnique({
          where: { id: prodId },
          include: { recetas: { include: { ingrediente: true } } },
        });

        if (!producto || !producto.estaDisponible) {
          throw new Error(`El producto '${prodId}' no existe o no está disponible`);
        }

        // 🛠️ NUEVO: Sumar tiempo estimado * cantidad de la nueva ronda
        const tiempoProducto = (producto as any).tiempoPreparacionMinutos || 15;
        tiempoRondaAdicional += tiempoProducto * cant;

        for (const receta of producto.recetas) {
          const cantidadRequeridaTotal = Number(receta.cantidadRequerida) * cant;
          const ingrediente = receta.ingrediente;

          if (Number(ingrediente.stockActual) < cantidadRequeridaTotal) {
            throw new Error(`Stock insuficiente de '${ingrediente.nombre}'. Requerido: ${cantidadRequeridaTotal}, Disponible: ${ingrediente.stockActual}`);
          }

          await tx.ingredient.update({
            where: { id: ingrediente.id },
            data: { stockActual: { decrement: cantidadRequeridaTotal } },
          });

          await tx.inventoryMovement.create({
            data: {
              ingredienteId: ingrediente.id,
              usuarioId: meseroId || null,
              tipoMovimiento: 'SALIDA_VENTA',
              cantidad: cantidadRequeridaTotal,
              costoTotal: Number(ingrediente.costoUnitario || 0) * cantidadRequeridaTotal,
              observaciones: `Ronda ${nuevaRonda} POS en orden '${ordenExistente.id}' del producto '${producto.nombre}' (x${cant})`,
            },
          });
        }

        const precioUnitario = Number(producto.precio);
        const subtotalItem = precioUnitario * cant;
        subtotalAdicional += subtotalItem;
        resumenRonda.push(`${cant}x ${producto.nombre}`);

        const yaEnRonda = detallesCrear.find((d) => d.productoId === producto.id);
        if (yaEnRonda) {
          yaEnRonda.cantidad += cant;
          yaEnRonda.subtotal += subtotalItem;
        } else {
          detallesCrear.push({
            productoId: producto.id,
            cantidad: cant,
            precioUnitario,
            subtotal: subtotalItem,
            estadoCocina: 'en_espera',
            ronda: nuevaRonda,
          });
        }
      }

      const etiquetaRonda = `[Ronda ${nuevaRonda}: ${resumenRonda.join(', ')}${notas && String(notas).trim() ? ` · ${String(notas).trim()}` : ''}]`;
      const notasActualizadas = ordenExistente.notas ? `${ordenExistente.notas} | ${etiquetaRonda}` : etiquetaRonda;

      const hayAvancePrevio = ordenExistente.detalles.some((d) => d.estadoCocina === 'en_preparacion' || d.estadoCocina === 'listo');
      const nuevoEstadoOrden = hayAvancePrevio ? 'en_preparacion' : 'pendiente';

      const orden = await tx.order.update({
        where: { id: ordenExistente.id },
        data: {
          estado: nuevoEstadoOrden,
          subtotal: { increment: subtotalAdicional },
          total: { increment: subtotalAdicional },
          notas: notasActualizadas,
          detalles: { create: detallesCrear },
        },
        include: {
          detalles: {
            include: { producto: true },
            orderBy: [{ ronda: 'asc' }, { creadoEn: 'asc' }],
          },
          mesa: true,
        },
      });

      // 🛠️ CORRECCIÓN: Si es una ronda nueva, sumar su tiempo al tiempo existente
      await tx.kitchenTime.upsert({
        where: { ordenId: orden.id },
        update: {
          estadoCocina: hayAvancePrevio ? 'en_preparacion' : 'en_espera',
          listoEn: null,
          // Sumamos el tiempo de la nueva ronda al tiempo que ya tenía la comanda
          tiempoEstimadoMinutos: {
            increment: tiempoRondaAdicional > 0 ? tiempoRondaAdicional : 15,
          },
        },
        create: {
          ordenId: orden.id,
          tiempoEstimadoMinutos: tiempoRondaAdicional > 0 ? tiempoRondaAdicional : 15,
          estadoCocina: 'en_espera',
        },
      });

      return orden;
    });

    emitEvent('cocina:nueva-comanda', {
      ordenId: ordenActualizada.id,
      folio: ordenActualizada.folio,
      mesa: ordenActualizada.mesa?.numeroMesa || null,
      tipoOrden: ordenActualizada.tipoOrden,
      esRondaAdicional: true,
    });

    res.status(200).json({
      message: 'Ronda agregada a la cuenta sin reiniciar tiempos de cocina',
      orden: ordenActualizada,
    });
  } catch (error) {
    console.error('Error al agregar productos a la orden:', error);
    if (error instanceof Error) {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Error interno al agregar productos a la orden' });
  }
};

// 4. CANCELAR ORDEN
export const cancelarOrden = async (req: Request, res: Response): Promise<void> => {
  try {
    const ordenId = req.params.id;
    const usuarioId = req.usuario?.id;
    const { motivo } = req.body || {};

    if (typeof ordenId !== 'string' || !ordenId.trim()) {
      res.status(400).json({ message: 'El ID de la orden es inválido' });
      return;
    }

    const ordenCancelada = await prisma.$transaction(async (tx) => {
      const orden = await tx.order.findUnique({
        where: { id: ordenId.trim() },
        include: {
          detalles: { include: { producto: { include: { recetas: { include: { ingrediente: true } } } } } },
        },
      });

      if (!orden) throw new Error('La orden no existe');
      if (orden.estado === 'pagado') throw new Error('No se puede cancelar una orden que ya fue pagada');
      if (orden.estado === 'cancelado') throw new Error('Esta orden ya se encuentra cancelada');

      for (const detalle of orden.detalles) {
        for (const receta of detalle.producto.recetas) {
          const cantidadDevolver = Number(receta.cantidadRequerida) * detalle.cantidad;
          const ingrediente = receta.ingrediente;

          await tx.ingredient.update({
            where: { id: ingrediente.id },
            data: { stockActual: { increment: cantidadDevolver } },
          });

          await tx.inventoryMovement.create({
            data: {
              ingredienteId: ingrediente.id,
              usuarioId: usuarioId || null,
              tipoMovimiento: 'ENTRADA_CANCELACION',
              cantidad: cantidadDevolver,
              costoTotal: Number(ingrediente.costoUnitario || 0) * cantidadDevolver,
              observaciones: `Reintegro por cancelación de orden '${orden.id}' (${detalle.cantidad}x ${detalle.producto.nombre})`,
            },
          });
        }
      }

      const textoMotivo = motivo && String(motivo).trim() ? String(motivo).trim() : 'Sin motivo especificado';
      const notasCancelacion = orden.notas ? `${orden.notas} | [CANCELADA: ${textoMotivo}]` : `[CANCELADA: ${textoMotivo}]`;

      const ordenActualizada = await tx.order.update({
        where: { id: orden.id },
        data: { estado: 'cancelado', notas: notasCancelacion },
      });

      await tx.orderItem.updateMany({ where: { ordenId: orden.id }, data: { estadoCocina: 'cancelado' } });
      await tx.kitchenTime.updateMany({ where: { ordenId: orden.id }, data: { estadoCocina: 'cancelado' } });

      if (orden.mesaId) {
        const otrasOrdenesActivas = await tx.order.count({
          where: { mesaId: orden.mesaId, id: { not: orden.id }, estado: { notIn: ['pagado', 'cancelado'] } },
        });
        if (otrasOrdenesActivas === 0) {
          await tx.table.update({ where: { id: orden.mesaId }, data: { estado: 'disponible' } });
        }
      }

      return ordenActualizada;
    });

    emitEvent('cocina:orden-cancelada', { ordenId: ordenCancelada.id, folio: ordenCancelada.folio });
    emitEvent('pos:orden-actualizada', { ordenId: ordenCancelada.id });

    res.status(200).json({
      message: 'Orden cancelada, insumos reintegrados al inventario y mesa actualizada',
      orden: ordenCancelada,
    });
  } catch (error) {
    console.error('Error al cancelar orden:', error);
    if (error instanceof Error) {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Error interno al cancelar la orden' });
  }
};

// 5. OBTENER HISTORIAL
export const obtenerMisOrdenes = async (req: Request, res: Response): Promise<void> => {
  try {
    const r = req as any;
    const usuarioId = r.usuario?.id || r.user?.id || r.userId;

    if (!usuarioId) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    const ordenes = await prisma.order.findMany({
      where: { usuarioId },
      include: {
        detalles: {
          include: { producto: { select: { id: true, nombre: true, descripcion: true, precio: true, urlImagen: true, estaDisponible: true } } },
          orderBy: [{ ronda: 'asc' }, { creadoEn: 'asc' }],
        },
        tiemposCocina: true,
      },
      orderBy: { creadoEn: 'desc' },
    });

    res.status(200).json({ ordenes });
  } catch (error) {
    console.error('Error al obtener las órdenes del cliente:', error);
    res.status(500).json({ message: 'Error interno al consultar tus pedidos' });
  }
};