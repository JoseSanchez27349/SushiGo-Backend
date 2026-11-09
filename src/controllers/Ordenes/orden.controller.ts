import { Request, Response } from 'express';
import prisma from '../../config/prisma';

// 1. CREAR ÓRDEN / COMANDA POS
export const crearOrden = async (req: Request, res: Response): Promise<void> => {
  try {
    const meseroId = req.usuario?.id;
    const { tipoOrden, mesaId, usuarioId, notas, items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: 'Debe incluir al menos un producto en la orden' });
      return;
    }

    const tipo = tipoOrden ? String(tipoOrden).toLowerCase() : 'comedor';

    if (tipo === 'comedor' || tipo === 'mesa') {
      if (!mesaId) {
        res.status(400).json({ message: 'Para órdenes de comedor debe especificar mesaId' });
        return;
      }
    }

    // Transacción atómica: Stock + Movimientos + Orden + Detalles + Tiempos Cocina
    const ordenCreada = await prisma.$transaction(async (tx) => {
      let subtotalTotal = 0;
      const detallesProcesados = [];

      for (const item of items) {
        const prodId = item.productoId?.trim();
        const cant = Number(item.cantidad);

        if (!prodId || isNaN(cant) || cant <= 0) {
          throw new Error('Cada producto debe tener un productoId válido y cantidad > 0');
        }

        const producto = await tx.product.findUnique({
          where: { id: prodId },
          include: {
            recetas: {
              include: { ingrediente: true },
            },
          },
        });

        if (!producto || !producto.estaDisponible) {
          throw new Error(`El producto con ID '${prodId}' no existe o no está disponible`);
        }

        // A. Verificar y descontar stock según la receta (BOM)
        for (const receta of producto.recetas) {
          const cantidadRequeridaTotal = Number(receta.cantidadRequerida) * cant;
          const ingrediente = receta.ingrediente;

          if (Number(ingrediente.stockActual) < cantidadRequeridaTotal) {
            throw new Error(
              `Stock insuficiente de '${ingrediente.nombre}'. Requerido: ${cantidadRequeridaTotal} ${ingrediente.unidadMedida}, Disponible: ${ingrediente.stockActual} ${ingrediente.unidadMedida}`,
            );
          }

          // Descuento en la tabla de ingredientes
          await tx.ingredient.update({
            where: { id: ingrediente.id },
            data: {
              stockActual: {
                decrement: cantidadRequeridaTotal,
              },
            },
          });

          // Registro del movimiento de inventario (Auditoría)
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
        subtotalTotal += subtotalItem;

        detallesProcesados.push({
          productoId: producto.id,
          cantidad: cant,
          precioUnitario: precioUnitario,
          subtotal: subtotalItem,
        });
      }

      // B. Cambiar estado de la mesa a ocupada si aplica
      if (mesaId) {
        await tx.table.update({
          where: { id: Number(mesaId) },
          data: { estado: 'ocupada' },
        });
      }

      // C. Crear registro principal de la Orden
      const orden = await tx.order.create({
        data: {
          tipoOrden: tipo,
          mesaId: mesaId ? Number(mesaId) : null,
          meseroId: meseroId || null,
          usuarioId: usuarioId || null,
          estado: 'pendiente',
          subtotal: subtotalTotal,
          costoEnvio: 0.0,
          total: subtotalTotal,
          notas: notas || null,
          detalles: {
            create: detallesProcesados,
          },
        },
        include: {
          detalles: {
            include: { producto: true },
          },
          mesa: true,
        },
      });

      // D. Iniciar registro de tiempos de preparación para Control de Cocina (KDS)
      await tx.kitchenTime.create({
        data: {
          ordenId: orden.id,
          tiempoEstimadoMinutos: 15,
          estadoCocina: 'en_espera',
        },
      });

      return orden;
    });

    res.status(201).json({
      message: 'Orden procesada correctamente y stock de insumos descontado',
      orden: ordenCreada,
    });
  } catch (error) {
    console.error('Error al crear orden:', error);
    if (error instanceof Error) {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Error interno al procesar la orden' });
  }
};

// 2. OBTENER ÓRDENES ACTIVAS
export const obtenerOrdenesActivas = async (_req: Request, res: Response): Promise<void> => {
  try {
    const ordenes = await prisma.order.findMany({
      where: {
        estado: { notIn: ['pagado', 'cancelado'] },
      },
      include: {
        mesa: true,
        mesero: { select: { id: true, nombre: true, apellido: true } },
        detalles: {
          include: { producto: true },
        },
        tiemposCocina: true,
      },
      orderBy: { creadoEn: 'desc' },
    });

    res.status(200).json({ ordenes });
  } catch (error) {
    console.error('Error al obtener órdenes activas:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};
