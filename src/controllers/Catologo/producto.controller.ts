import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../config/prisma';

// 1. CREAR PRODUCTO
export const crearProducto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoriaId, nombre, descripcion, precio, urlImagen, estaDisponible } = req.body;

    if (!categoriaId || !nombre || precio === undefined) {
      res.status(400).json({ message: 'Los campos categoriaId, nombre y precio son obligatorios' });
      return;
    }

    const catIdNum = Number(categoriaId);
    if (isNaN(catIdNum)) {
      res.status(400).json({ message: 'El categoriaId debe ser un número entero' });
      return;
    }

    if (nombre.length > 100) {
      res
        .status(400)
        .json({ message: 'El nombre del producto no puede exceder los 100 caracteres' });
      return;
    }

    if (urlImagen && urlImagen.length > 255) {
      res.status(400).json({ message: 'La URL de la imagen no puede exceder los 255 caracteres' });
      return;
    }

    const precioNum = Number(precio);
    if (isNaN(precioNum) || precioNum < 0) {
      res.status(400).json({ message: 'El precio debe ser un número válido mayor o igual a 0' });
      return;
    }

    const categoriaExiste = await prisma.category.findUnique({ where: { id: catIdNum } });
    if (!categoriaExiste) {
      res.status(404).json({ message: `La categoría con ID ${catIdNum} no existe` });
      return;
    }

    const nuevoProducto = await prisma.product.create({
      data: {
        categoriaId: catIdNum,
        nombre,
        descripcion,
        precio: precioNum,
        urlImagen,
        estaDisponible: typeof estaDisponible === 'boolean' ? estaDisponible : true,
      },
      include: {
        categoria: { select: { id: true, nombre: true, slug: true } },
      },
    });

    res.status(201).json({ message: 'Producto creado exitosamente', producto: nuevoProducto });
  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// 2. LISTAR PRODUCTOS (Filtro opcional por categoría o disponibilidad)
export const obtenerProductos = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoriaId, disponible } = req.query;

    const filtroWhere: Prisma.ProductWhereInput = {};

    if (categoriaId !== undefined) {
      if (typeof categoriaId !== 'string') {
        res.status(400).json({ message: 'El categoriaId debe ser un único valor' });
        return;
      }
      const catId = Number(categoriaId);
      if (isNaN(catId)) {
        res.status(400).json({ message: 'El categoriaId debe ser un número válido' });
        return;
      }
      filtroWhere.categoriaId = catId;
    }

    if (disponible !== undefined) {
      filtroWhere.estaDisponible = disponible === 'true';
    }

    const productos = await prisma.product.findMany({
      where: filtroWhere,
      include: {
        categoria: { select: { id: true, nombre: true, slug: true } },
      },
      orderBy: { creadoEn: 'desc' },
    });

    res.status(200).json({ productos });
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// 3. OBTENER PRODUCTO POR ID
export const obtenerProductoPorId = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El ID del producto debe ser un texto válido' });
      return;
    }

    const producto = await prisma.product.findUnique({
      where: { id },
      include: {
        categoria: { select: { id: true, nombre: true, slug: true } },
        recetas: {
          include: { ingrediente: true },
        },
      },
    });

    if (!producto) {
      res.status(404).json({ message: 'Producto no encontrado' });
      return;
    }

    res.status(200).json({ producto });
  } catch (error) {
    console.error('Error al obtener el producto:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// 4. ACTUALIZAR PRODUCTO
export const actualizarProducto = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El ID del producto debe ser un texto válido' });
      return;
    }
    const { categoriaId, nombre, descripcion, precio, urlImagen, estaDisponible } = req.body;

    const productoExistente = await prisma.product.findUnique({ where: { id } });
    if (!productoExistente) {
      res.status(404).json({ message: 'Producto no encontrado' });
      return;
    }

    const datosActualizacion: Prisma.ProductUncheckedUpdateInput = {};

    if (nombre) {
      if (nombre.length > 100) {
        res.status(400).json({ message: 'El nombre no puede exceder los 100 caracteres' });
        return;
      }
      datosActualizacion.nombre = nombre;
    }

    if (urlImagen !== undefined) {
      if (urlImagen && urlImagen.length > 255) {
        res
          .status(400)
          .json({ message: 'La URL de la imagen no puede exceder los 255 caracteres' });
        return;
      }
      datosActualizacion.urlImagen = urlImagen;
    }

    if (descripcion !== undefined) datosActualizacion.descripcion = descripcion;
    if (typeof estaDisponible === 'boolean') datosActualizacion.estaDisponible = estaDisponible;

    if (precio !== undefined) {
      const precioNum = Number(precio);
      if (isNaN(precioNum) || precioNum < 0) {
        res.status(400).json({ message: 'El precio debe ser un número válido mayor o igual a 0' });
        return;
      }
      datosActualizacion.precio = precioNum;
    }

    if (categoriaId) {
      const catIdNum = Number(categoriaId);
      if (isNaN(catIdNum)) {
        res.status(400).json({ message: 'El categoriaId debe ser un número entero' });
        return;
      }
      const catExiste = await prisma.category.findUnique({ where: { id: catIdNum } });
      if (!catExiste) {
        res.status(404).json({ message: `La categoría con ID ${catIdNum} no existe` });
        return;
      }
      datosActualizacion.categoriaId = catIdNum;
    }

    const productoActualizado = await prisma.product.update({
      where: { id },
      data: datosActualizacion,
      include: {
        categoria: { select: { id: true, nombre: true, slug: true } },
      },
    });

    res
      .status(200)
      .json({ message: 'Producto actualizado exitosamente', producto: productoActualizado });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// 5. ELIMINAR / DESACTIVAR PRODUCTO
export const eliminarProducto = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El ID del producto debe ser un texto válido' });
      return;
    }

    const producto = await prisma.product.findUnique({ where: { id } });
    if (!producto) {
      res.status(404).json({ message: 'Producto no encontrado' });
      return;
    }

    try {
      await prisma.product.delete({ where: { id } });
      res.status(200).json({ message: 'Producto eliminado permanentemente de la base de datos' });
    } catch (dbError) {
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2003') {
        await prisma.product.update({
          where: { id },
          data: { estaDisponible: false },
        });
        res.status(200).json({
          message:
            'El producto está vinculado a historial de órdenes o carritos. Se deshabilitó su disponibilidad en su lugar.',
        });
        return;
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};
