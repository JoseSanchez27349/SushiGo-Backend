import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../config/prisma';

// 1. CREAR INGREDIENTE
export const crearIngrediente = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, unidadMedida, stockActual, stockMinimo, costoUnitario } = req.body;

    if (!nombre || !unidadMedida) {
      res.status(400).json({ message: 'El nombre y la unidad de medida son obligatorios' });
      return;
    }

    if (nombre.length > 100) {
      res.status(400).json({ message: 'El nombre no puede exceder los 100 caracteres' });
      return;
    }

    if (unidadMedida.length > 20) {
      res.status(400).json({
        message: 'La unidad de medida no puede exceder los 20 caracteres (ej: kg, g, ml, pza)',
      });
      return;
    }

    const stockActualNum = stockActual !== undefined ? Number(stockActual) : 0;
    const stockMinimoNum = stockMinimo !== undefined ? Number(stockMinimo) : 0;
    const costoNum = costoUnitario !== undefined ? Number(costoUnitario) : 0;

    if (
      isNaN(stockActualNum) ||
      stockActualNum < 0 ||
      isNaN(stockMinimoNum) ||
      stockMinimoNum < 0
    ) {
      res
        .status(400)
        .json({ message: 'Los valores de stock deben ser números mayores o iguales a 0' });
      return;
    }

    const nuevoIngrediente = await prisma.ingredient.create({
      data: {
        nombre,
        unidadMedida,
        stockActual: stockActualNum,
        stockMinimo: stockMinimoNum,
        costoUnitario: costoNum,
      },
    });

    res
      .status(201)
      .json({ message: 'Ingrediente creado exitosamente', ingrediente: nuevoIngrediente });
  } catch (error) {
    console.error('Error al crear ingrediente:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// 2. OBTENER INGREDIENTES (Con flag de alerta si está por debajo del stock mínimo)
export const obtenerIngredientes = async (_req: Request, res: Response): Promise<void> => {
  try {
    const ingredientes = await prisma.ingredient.findMany({
      orderBy: { nombre: 'asc' },
    });

    const respuesta = ingredientes.map((item) => ({
      ...item,
      bajoStock: item.stockActual <= item.stockMinimo,
    }));

    res.status(200).json({ ingredientes: respuesta });
  } catch (error) {
    console.error('Error al obtener ingredientes:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// 3. ACTUALIZAR INGREDIENTE / REABASTECER STOCK
export const actualizarIngrediente = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El ID del ingrediente debe ser un texto válido' });
      return;
    }
    const { nombre, unidadMedida, stockActual, stockMinimo, costoUnitario } = req.body;

    const ingredienteExistente = await prisma.ingredient.findUnique({ where: { id } });
    if (!ingredienteExistente) {
      res.status(404).json({ message: 'Ingrediente no encontrado' });
      return;
    }

    const datosActualizacion: Prisma.IngredientUncheckedUpdateInput = {};

    if (nombre) {
      if (nombre.length > 100) {
        res.status(400).json({ message: 'El nombre no puede exceder los 100 caracteres' });
        return;
      }
      datosActualizacion.nombre = nombre;
    }

    if (unidadMedida) {
      if (unidadMedida.length > 20) {
        res.status(400).json({ message: 'La unidad de medida no puede exceder los 20 caracteres' });
        return;
      }
      datosActualizacion.unidadMedida = unidadMedida;
    }

    if (stockActual !== undefined) {
      const stockNum = Number(stockActual);
      if (isNaN(stockNum) || stockNum < 0) {
        res.status(400).json({ message: 'El stock actual debe ser un número válido >= 0' });
        return;
      }
      datosActualizacion.stockActual = stockNum;
    }

    if (stockMinimo !== undefined) {
      const stockMinNum = Number(stockMinimo);
      if (isNaN(stockMinNum) || stockMinNum < 0) {
        res.status(400).json({ message: 'El stock mínimo debe ser un número válido >= 0' });
        return;
      }
      datosActualizacion.stockMinimo = stockMinNum;
    }

    if (costoUnitario !== undefined) {
      const costoNum = Number(costoUnitario);
      if (isNaN(costoNum) || costoNum < 0) {
        res.status(400).json({ message: 'El costo unitario debe ser un número válido >= 0' });
        return;
      }
      datosActualizacion.costoUnitario = costoNum;
    }

    const ingredienteActualizado = await prisma.ingredient.update({
      where: { id },
      data: datosActualizacion,
    });

    res.status(200).json({
      message: 'Ingrediente actualizado correctamente',
      ingrediente: ingredienteActualizado,
    });
  } catch (error) {
    console.error('Error al actualizar ingrediente:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// 4. ELIMINAR INGREDIENTE
export const eliminarIngrediente = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El ID del ingrediente debe ser un texto válido' });
      return;
    }

    const ingrediente = await prisma.ingredient.findUnique({ where: { id } });
    if (!ingrediente) {
      res.status(404).json({ message: 'Ingrediente no encontrado' });
      return;
    }

    try {
      await prisma.ingredient.delete({ where: { id } });
      res.status(200).json({ message: 'Ingrediente eliminado permanentemente' });
    } catch (dbError) {
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2003') {
        res.status(400).json({
          message:
            'No se puede eliminar el ingrediente porque está siendo utilizado en la receta de uno o más productos.',
        });
        return;
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Error al eliminar ingrediente:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};
