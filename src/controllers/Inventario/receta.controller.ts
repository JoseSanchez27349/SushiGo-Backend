import { Request, Response } from 'express';
import prisma from '../../config/prisma';

// 1. DEFINIR / REEMPLAZAR LA RECETA COMPLETA DE UN PRODUCTO (BOM)
export const guardarRecetaProducto = async (req: Request, res: Response): Promise<void> => {
  try {
    const productoId = req.params.productoId;
    if (typeof productoId !== 'string') {
      res.status(400).json({ message: 'El ID del producto debe ser un texto válido' });
      return;
    }
    const { ingredientes } = req.body; // Array de objetos: [{ ingredienteId: string, cantidad: number }]

    if (!Array.isArray(ingredientes)) {
      res.status(400).json({ message: 'Debe enviar un arreglo de ingredientes' });
      return;
    }

    const productoExiste = await prisma.product.findUnique({ where: { id: productoId } });
    if (!productoExiste) {
      res.status(404).json({ message: 'El producto especificado no existe' });
      return;
    }

    // Validar formato de los insumos enviados
    for (const item of ingredientes) {
      if (!item.ingredienteId || item.cantidad === undefined) {
        res.status(400).json({ message: 'Cada elemento debe contener ingredienteId y cantidad' });
        return;
      }
      const cant = Number(item.cantidad);
      if (isNaN(cant) || cant <= 0) {
        res.status(400).json({ message: 'La cantidad requerida debe ser mayor a 0' });
        return;
      }
    }

    // Transacción: Elimina la receta actual del producto e inserta la nueva
    await prisma.$transaction(async (tx) => {
      await tx.recipe.deleteMany({
        where: { productoId },
      });

      if (ingredientes.length > 0) {
        await tx.recipe.createMany({
          data: ingredientes.map((item: { ingredienteId: string; cantidad: number }) => ({
            productoId,
            ingredienteId: item.ingredienteId,
            cantidadRequerida: Number(item.cantidad),
          })),
        });
      }
    });

    // Obtener la receta actualizada con el cálculo total del costo de producción (BOM)
    const recetaActualizada = await prisma.recipe.findMany({
      where: { productoId },
      include: { ingrediente: true },
    });

    const costoProduccionTotal = recetaActualizada.reduce((acc, curr) => {
      const costoItem =
        Number(curr.ingrediente.costoUnitario || 0) * Number(curr.cantidadRequerida);
      return acc + costoItem;
    }, 0);

    res.status(200).json({
      message: 'Receta / BOM del producto configurada correctamente',
      producto: productoExiste.nombre,
      costoProduccionTotal: Number(costoProduccionTotal.toFixed(2)),
      receta: recetaActualizada,
    });
  } catch (error) {
    console.error('Error al guardar receta:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// 2. OBTENER RECETA Y COSTO DE PRODUCCIÓN DE UN PRODUCTO
export const obtenerRecetaProducto = async (req: Request, res: Response): Promise<void> => {
  try {
    const productoId = req.params.productoId;
    if (typeof productoId !== 'string') {
      res.status(400).json({ message: 'El ID del producto debe ser un texto válido' });
      return;
    }

    const producto = await prisma.product.findUnique({
      where: { id: productoId },
      include: {
        recetas: {
          include: { ingrediente: true },
        },
      },
    });

    if (!producto) {
      res.status(404).json({ message: 'Producto no encontrado' });
      return;
    }

    const costoProduccion = producto.recetas.reduce((acc, item) => {
      return acc + Number(item.ingrediente.costoUnitario || 0) * Number(item.cantidadRequerida);
    }, 0);

    const margenGanancia = Number(producto.precio) - costoProduccion;

    res.status(200).json({
      productoId: producto.id,
      nombreProducto: producto.nombre,
      precioVenta: producto.precio,
      costoProduccion: Number(costoProduccion.toFixed(2)),
      margenEstimado: Number(margenGanancia.toFixed(2)),
      receta: producto.recetas,
    });
  } catch (error) {
    console.error('Error al obtener receta:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// 3. ELIMINAR UN INGREDIENTE ESPECÍFICO DE LA RECETA
export const eliminarIngredienteDeReceta = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productoId, ingredienteId } = req.params;
    if (typeof productoId !== 'string' || typeof ingredienteId !== 'string') {
      res.status(400).json({ message: 'Los IDs del producto y del ingrediente son inválidos' });
      return;
    }

    const existeRelacion = await prisma.recipe.findFirst({
      where: { productoId, ingredienteId },
    });

    if (!existeRelacion) {
      res.status(404).json({ message: 'Ese ingrediente no forma parte de la receta del producto' });
      return;
    }

    await prisma.recipe.delete({
      where: { id: existeRelacion.id },
    });

    res.status(200).json({ message: 'Ingrediente removido de la receta correctamente' });
  } catch (error) {
    console.error('Error al remover ingrediente de la receta:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};
