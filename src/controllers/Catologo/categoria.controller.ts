import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../config/prisma';

// Función auxiliar para generar slugs URL-friendly
const generarSlug = (texto: string): string => {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-z0-9 -]/g, '')
    .trim()
    .replace(/\s+/g, '-');
};

// 1. CREAR CATEGORÍA
export const crearCategoria = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, descripcion } = req.body;

    if (!nombre) {
      res.status(400).json({ message: 'El nombre de la categoría es obligatorio' });
      return;
    }

    if (nombre.length > 50) {
      res.status(400).json({ message: 'El nombre no puede exceder los 50 caracteres' });
      return;
    }

    const slug = generarSlug(nombre);

    const existeCategoria = await prisma.category.findFirst({
      where: { OR: [{ nombre }, { slug }] },
    });

    if (existeCategoria) {
      res.status(409).json({ message: 'Ya existe una categoría con ese nombre o slug' });
      return;
    }

    const nuevaCategoria = await prisma.category.create({
      data: {
        nombre,
        slug,
        descripcion,
      },
    });

    res.status(201).json({ message: 'Categoría creada exitosamente', categoria: nuevaCategoria });
  } catch (error) {
    console.error('Error al crear categoría:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// 2. LISTAR CATEGORÍAS
export const obtenerCategorias = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categorias = await prisma.category.findMany({
      include: {
        _count: { select: { productos: true } },
      },
      orderBy: { nombre: 'asc' },
    });

    res.status(200).json({ categorias });
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// 3. ACTUALIZAR CATEGORÍA
export const actualizarCategoria = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? parseInt(rawId, 10) : Number.NaN;
    const { nombre, descripcion, estaActiva } = req.body;

    if (isNaN(id)) {
      res.status(400).json({ message: 'El ID de la categoría debe ser un número entero' });
      return;
    }

    const categoriaExistente = await prisma.category.findUnique({ where: { id } });
    if (!categoriaExistente) {
      res.status(404).json({ message: 'Categoría no encontrada' });
      return;
    }

    const datosActualizacion: Prisma.CategoryUpdateInput = {};
    if (typeof estaActiva === 'boolean') datosActualizacion.estaActiva = estaActiva;
    if (descripcion !== undefined) datosActualizacion.descripcion = descripcion;

    if (nombre) {
      if (nombre.length > 50) {
        res.status(400).json({ message: 'El nombre no puede exceder los 50 caracteres' });
        return;
      }

      const nuevoSlug = generarSlug(nombre);
      const conflicto = await prisma.category.findFirst({
        where: {
          AND: [{ id: { not: id } }, { OR: [{ nombre }, { slug: nuevoSlug }] }],
        },
      });

      if (conflicto) {
        res.status(409).json({ message: 'Ya existe otra categoría con ese nombre o slug' });
        return;
      }

      datosActualizacion.nombre = nombre;
      datosActualizacion.slug = nuevoSlug;
    }

    const categoriaActualizada = await prisma.category.update({
      where: { id },
      data: datosActualizacion,
    });

    res
      .status(200)
      .json({ message: 'Categoría actualizada correctamente', categoria: categoriaActualizada });
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// 4. ELIMINAR / DESACTIVAR CATEGORÍA
export const eliminarCategoria = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? parseInt(rawId, 10) : Number.NaN;

    if (isNaN(id)) {
      res.status(400).json({ message: 'El ID de la categoría debe ser un número entero' });
      return;
    }

    const categoria = await prisma.category.findUnique({ where: { id } });
    if (!categoria) {
      res.status(404).json({ message: 'Categoría no encontrada' });
      return;
    }

    try {
      await prisma.category.delete({ where: { id } });
      res.status(200).json({ message: 'Categoría eliminada permanentemente' });
    } catch (dbError) {
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2003') {
        await prisma.category.update({
          where: { id },
          data: { estaActiva: false },
        });
        res.status(200).json({
          message:
            'La categoría tiene productos asociados. Se procedió a desactivarla en su lugar.',
        });
        return;
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};
