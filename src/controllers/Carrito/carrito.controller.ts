import { Request, Response } from 'express';
import prisma from '../../config/prisma';
import { emitEvent } from '../../config/socket';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getUsuarioId = (req: Request): string | undefined => {
  const r = req as any;
  return r.user?.id || r.usuario?.id || r.userId;
};

async function buildCarritoResponse(usuarioId: string) {
  let carrito = await prisma.cart.findUnique({
    where: { usuarioId },
    include: {
      elementos: {
        orderBy: { creadoEn: 'asc' },
        include: {
          producto: {
            select: {
              id: true,
              nombre: true,
              descripcion: true,
              precio: true,
              urlImagen: true,
              estaDisponible: true,
            },
          },
        },
      },
    },
  });

  if (!carrito) {
    carrito = await prisma.cart.create({
      data: { usuarioId },
      include: {
        elementos: {
          include: {
            producto: {
              select: {
                id: true,
                nombre: true,
                descripcion: true,
                precio: true,
                urlImagen: true,
                estaDisponible: true,
              },
            },
          },
        },
      },
    });
  }

  let totalArticulos = 0;
  let total = 0;

  const items = carrito.elementos.map((el) => {
    const precioUnitario = Number(el.producto.precio);
    const subtotal = Number((precioUnitario * el.cantidad).toFixed(2));
    totalArticulos += el.cantidad;
    total = Number((total + subtotal).toFixed(2));

    return {
      id: el.id,
      productoId: el.productoId,
      cantidad: el.cantidad,
      precioUnitario,
      subtotal,
      producto: el.producto,
    };
  });

  return {
    id: carrito.id,
    usuarioId: carrito.usuarioId,
    totalArticulos,
    total,
    items,
  };
}

// GET /api/v1/carrito
export const obtenerMiCarrito = async (req: Request, res: Response) => {
  try {
    const usuarioId = getUsuarioId(req);
    if (!usuarioId) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    const data = await buildCarritoResponse(usuarioId);
    return res.json(data);
  } catch (error) {
    console.error('Error al obtener carrito:', error);
    return res.status(500).json({ message: 'Error al consultar el carrito' });
  }
};

// POST /api/v1/carrito/items
export const agregarItemCarrito = async (req: Request, res: Response) => {
  try {
    const usuarioId = getUsuarioId(req);
    if (!usuarioId) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    const { productoId, cantidad = 1 } = req.body;
    const qty = Number(cantidad);

    if (!productoId || !UUID_REGEX.test(String(productoId)) || qty <= 0) {
      return res
        .status(400)
        .json({ message: 'Un productoId válido (UUID) y cantidad mayor a 0 son requeridos' });
    }

    const producto = await prisma.product.findUnique({
      where: { id: productoId },
    });

    if (!producto || !producto.estaDisponible) {
      return res
        .status(400)
        .json({ message: 'El producto no existe o no está disponible actualmente' });
    }

    const carrito = await prisma.cart.upsert({
      where: { usuarioId },
      update: {},
      create: { usuarioId },
    });

    const itemExistente = await prisma.cartItem.findUnique({
      where: {
        unico_carrito_producto: {
          carritoId: carrito.id,
          productoId,
        },
      },
    });

    if (itemExistente) {
      await prisma.cartItem.update({
        where: { id: itemExistente.id },
        data: { cantidad: itemExistente.cantidad + qty },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          carritoId: carrito.id,
          productoId,
          cantidad: qty,
        },
      });
    }

    const data = await buildCarritoResponse(usuarioId);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error al agregar producto al carrito:', error);
    return res.status(500).json({ message: 'No se pudo agregar el producto al carrito' });
  }
};

// PATCH /api/v1/carrito/items/:itemId
export const actualizarItemCarrito = async (req: Request, res: Response) => {
  try {
    const usuarioId = getUsuarioId(req);
    if (!usuarioId) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    const { itemId } = req.params;
    if (typeof itemId !== 'string' || !UUID_REGEX.test(itemId)) {
      return res.status(400).json({ message: 'ID de elemento inválido' });
    }

    const qty = Number(req.body.cantidad);
    if (Number.isNaN(qty)) {
      return res.status(400).json({ message: 'La cantidad debe ser numérica' });
    }

    const item = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        carrito: { usuarioId },
      },
    });

    if (!item) {
      return res.status(404).json({ message: 'Elemento no encontrado en tu carrito' });
    }

    if (qty <= 0) {
      await prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      await prisma.cartItem.update({
        where: { id: item.id },
        data: { cantidad: qty },
      });
    }

    const data = await buildCarritoResponse(usuarioId);
    return res.json(data);
  } catch (error) {
    console.error('Error al actualizar elemento del carrito:', error);
    return res.status(500).json({ message: 'Error al actualizar el carrito' });
  }
};

// DELETE /api/v1/carrito/items/:itemId
export const eliminarItemCarrito = async (req: Request, res: Response) => {
  try {
    const usuarioId = getUsuarioId(req);
    if (!usuarioId) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    const { itemId } = req.params;
    const itemIdValue = Array.isArray(itemId) ? itemId[0] : itemId;

    if (typeof itemIdValue !== 'string' || !UUID_REGEX.test(itemIdValue)) {
      return res.status(400).json({ message: 'ID de elemento inválido' });
    }

    const deleted = await prisma.cartItem.deleteMany({
      where: {
        id: itemIdValue,
        carrito: { usuarioId },
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ message: 'El elemento no existe en tu carrito' });
    }

    const data = await buildCarritoResponse(usuarioId);
    return res.json(data);
  } catch (error) {
    console.error('Error al eliminar elemento del carrito:', error);
    return res.status(500).json({ message: 'Error al eliminar el elemento del carrito' });
  }
};

// DELETE /api/v1/carrito
export const vaciarCarrito = async (req: Request, res: Response) => {
  try {
    const usuarioId = getUsuarioId(req);
    if (!usuarioId) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    await prisma.cartItem.deleteMany({
      where: { carrito: { usuarioId } },
    });

    const data = await buildCarritoResponse(usuarioId);
    return res.json(data);
  } catch (error) {
    console.error('Error al vaciar carrito:', error);
    return res.status(500).json({ message: 'Error al vaciar el carrito' });
  }
};

// POST /api/v1/carrito/checkout
export const checkoutCarrito = async (req: Request, res: Response) => {
  try {
    const usuarioId = getUsuarioId(req);
    if (!usuarioId) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    const { metodoPago = 'efectivo', notas } = req.body;
    const carritoData = await buildCarritoResponse(usuarioId);

    if (carritoData.items.length === 0) {
      return res.status(400).json({ message: 'El carrito está vacío' });
    }

    const noDisponibles = carritoData.items.filter(
      (i) => !i.producto.estaDisponible,
    );
    if (noDisponibles.length > 0) {
      return res.status(400).json({
        message: `Productos sin disponibilidad: ${noDisponibles.map((i) => i.producto.nombre).join(', ')}`,
      });
    }

    const notaOrden = [
      notas ? String(notas).trim() : '',
      `App Móvil - Pago: ${metodoPago}`,
    ]
      .filter(Boolean)
      .join(' | ');

    const nuevaOrden = await prisma.$transaction(async (tx) => {
      // Validar y descontar stock de recetas igual que en POS
      for (const item of carritoData.items) {
        const productoConReceta = await tx.product.findUnique({
          where: { id: item.productoId },
          include: {
            recetas: {
              include: { ingrediente: true },
            },
          },
        });

        if (!productoConReceta || !productoConReceta.estaDisponible) {
          throw new Error(`El producto '${item.producto.nombre}' ya no está disponible`);
        }

        for (const receta of productoConReceta.recetas) {
          const cantidadRequeridaTotal = Number(receta.cantidadRequerida) * item.cantidad;
          const ingrediente = receta.ingrediente;

          if (Number(ingrediente.stockActual) < cantidadRequeridaTotal) {
            throw new Error(
              `Stock insuficiente para preparar '${productoConReceta.nombre}'`,
            );
          }

          await tx.ingredient.update({
            where: { id: ingrediente.id },
            data: {
              stockActual: {
                decrement: cantidadRequeridaTotal,
              },
            },
          });

          await tx.inventoryMovement.create({
            data: {
              ingredienteId: ingrediente.id,
              usuarioId,
              tipoMovimiento: 'SALIDA_VENTA',
              cantidad: cantidadRequeridaTotal,
              costoTotal: Number(ingrediente.costoUnitario || 0) * cantidadRequeridaTotal,
              observaciones: `Pedido App Móvil de '${productoConReceta.nombre}' (x${item.cantidad})`,
            },
          });
        }
      }

      const orden = await tx.order.create({
        data: {
          usuarioId,
          tipoOrden: 'llevar',
          estado: 'pendiente',
          subtotal: carritoData.total,
          costoEnvio: 0,
          total: carritoData.total,
          notas: notaOrden,
          detalles: {
            create: carritoData.items.map((item) => ({
              productoId: item.productoId,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitario,
              subtotal: item.subtotal,
              estadoCocina: 'en_espera',
              ronda: 1,
            })),
          },
          tiemposCocina: {
            create: {
              tiempoEstimadoMinutos: 15,
              estadoCocina: 'en_espera',
            },
          },
        },
        include: {
          usuario: {
            select: {
              id: true,
              nombre: true,
            },
          },
          detalles: {
            include: {
              producto: {
                select: {
                  id: true,
                  nombre: true,
                  precio: true,
                },
              },
            },
            orderBy: [{ ronda: 'asc' }, { creadoEn: 'asc' }],
          },
          tiemposCocina: true,
        },
      });

      await tx.cartItem.deleteMany({
        where: { carritoId: carritoData.id },
      });

      return orden;
    });

    // Notificar en tiempo real a Cocina (KDS) y POS con el mismo evento que crearOrden
    emitEvent('cocina:nueva-comanda', {
      ordenId: nuevaOrden.id,
      folio: nuevaOrden.folio,
      mesa: null,
      tipoOrden: nuevaOrden.tipoOrden,
      esRondaAdicional: false,
    });
    emitEvent('pos:orden-actualizada', { ordenId: nuevaOrden.id });

    return res.status(201).json({
      message: 'Pedido generado correctamente',
      orden: nuevaOrden,
    });
  } catch (error) {
    console.error('Error en checkout del carrito:', error);
    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    }
    return res
      .status(500)
      .json({ message: 'Error al procesar el pedido desde el carrito' });
  }
};