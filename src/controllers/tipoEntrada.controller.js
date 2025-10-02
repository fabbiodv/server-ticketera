import prisma from "../config/database.js";
import { PrismaClient } from "@prisma/client";
import { createEntrada } from "./entrada.controller.js";
export const createTipoEntrada = async (req, res) => {
  try {
    const prisma = new PrismaClient();
    const { nombre, precio, eventoId,totalEntradas ,maximoEntradasPorPersona } = req.body;
    if (!nombre || !precio || !eventoId || !maximoEntradasPorPersona) {
      return res.status(400).json({
        error: "Todos los campos son obligatorios: nombre, precio, eventoId, maximoEntradasPorPersona"
      });
    }

    const eventoExiste = await prisma.eventos.findUnique({
      where: { id: Number(eventoId) }
    });

    if (!eventoExiste) {
      return res.status(404).json({
        error: "El evento especificado no existe"
      });
    }

    const tipoEntrada = await prisma.tipoEntrada.create({
      data: {
        nombre,
        precio: Number(precio),
        eventoId: Number(eventoId),
        totalEntradas: Number(totalEntradas),
        maximoEntradasPorPersona: Number(maximoEntradasPorPersona),
        //por default campo estado: DISPONIBLE y campo disponible : true
      },
      include: {
        evento: true
      }
    });

    res.status(201).json({
      message: "Tipo de entrada creado exitosamente",
      tipoEntrada
    });

  } catch (error) {
    console.error("Error al crear tipo de entrada:", error);
    res.status(500).json({
      error: "Error al crear el tipo de entrada",
      details: error.message
    });
  }
};

export const updateTipoEntrada = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, precio, eventoId, maximoEntradasPorPersona } = req.body;
    
        // Validación de campos requeridos
        if (!nombre || !precio || !eventoId || !maximoEntradasPorPersona) {
        return res.status(400).json({
            error: "Todos los campos son obligatorios: nombre, precio, eventoId, maximoEntradasPorPersona"
        });
        }
    
        // Verificar que el tipo de entrada existe
        const tipoEntrada = await prisma.tipoEntrada.findUnique({
        where: { id: Number(id) }
        });
    
        if (!tipoEntrada) {
        return res.status(404).json({
            error: "El tipo de entrada especificado no existe"
        });
        }
    
        const updatedTipoEntrada = await prisma.tipoEntrada.update({
        where: { id: Number(id) },
        data: {
            nombre,
            precio: Number(precio),
            eventoId: Number(eventoId),
            maximoEntradasPorPersona: Number(maximoEntradasPorPersona)
        }
        });
    
        res.status(200).json({
        message: "Tipo de entrada actualizado exitosamente",
        updatedTipoEntrada
        });
    
    } catch (error) {
        console.error("Error al actualizar tipo de entrada:", error);
        res.status(500).json({
        error: "Error al actualizar el tipo de entrada",
        details: error.message
        });
    }
}
export const deleteTipoEntrada = async (req, res) => {
  try {
    const { id } = req.params;

    const tipoEntrada = await prisma.tipoEntrada.findUnique({
      where: { id: Number(id) }
    });

    if (!tipoEntrada) {
      return res.status(404).json({
        error: "El tipo de entrada especificado no existe"
      });
    }

    await prisma.tipoEntrada.delete({
      where: { id: Number(id) }
    });

    res.status(200).json({
      message: "Tipo de entrada eliminado exitosamente"
    });

  } catch (error) {
    console.error("Error al eliminar tipo de entrada:", error);
    res.status(500).json({
      error: "Error al eliminar el tipo de entrada",
      details: error.message
    });
  }
}
export const getTiposEntrada = async (req, res) => {
  try {
    const {
      page, limit, sortBy = 'nombre', sortOrder = 'asc',
      nombre, eventoId, estado, disponible,
      minPrecio, maxPrecio, minTotal, maxTotal,
      ...otherFilters
    } = req.query;

    const tipoEntradas = await prisma.tipoEntrada.findMany({
      where: {
        ...(nombre && { nombre: { contains: nombre, mode: 'insensitive' } }),
        ...(eventoId && { eventoId: parseInt(eventoId) }),
        ...(estado && { estado }),
        ...(disponible !== undefined && { disponible: disponible === 'true' }),
        ...((minPrecio || maxPrecio) && {
          precio: {
            ...(minPrecio && { gte: parseFloat(minPrecio) }),
            ...(maxPrecio && { lte: parseFloat(maxPrecio) })
          }
        }),
        ...((minTotal || maxTotal) && {
          totalEntradas: {
            ...(minTotal && { gte: parseInt(minTotal) }),
            ...(maxTotal && { lte: parseInt(maxTotal) })
          }
        }),

        // Filtros adicionales dinámicos
        ...Object.fromEntries(
          Object.entries(otherFilters)
            .filter(([_, value]) => value)
            .map(([key, value]) => [key, { contains: value, mode: 'insensitive' }])
        )
      },
      include: {
        evento: {
          select: {
            id: true,
            name: true,
            date: true,
            productora: { select: { name: true } }
          }
        },
        _count: {
          select: { Entrada: true }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      ...(limit && {
        skip: ((parseInt(page) || 1) - 1) * parseInt(limit),
        take: parseInt(limit)
      })
    });

    res.json(tipoEntradas);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tipos de entrada: ' + error.message });
  }
};

export const getTipoEntradaById = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeEvento, includeEntradas } = req.query;

    const tipoEntrada = await prisma.tipoEntrada.findUnique({
      where: { id: parseInt(id) },
      include: {
        ...(includeEvento === 'true' && {
          evento: {
            include: {
              productora: { select: { name: true, code: true } }
            }
          }
        }),
        ...(includeEntradas === 'true' && {
          Entrada: {
            include: {
              buyer: { select: { name: true, email: true } },
              seller: { select: { name: true, email: true } }
            }
          }
        }),
        _count: {
          select: { Entrada: true }
        }
      }
    });

    if (!tipoEntrada) {
      return res.status(404).json({ error: 'Tipo de entrada no encontrado' });
    }

    res.json(tipoEntrada);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tipo de entrada: ' + error.message });
  }
};
export const getTiposEntradaByEventoId = async (req, res) => {
  try {
    const { eventoId } = req.params;
    const tiposEntrada = await prisma.tipoEntrada.findMany({
      where: { eventoId: Number(eventoId) },
      include: { evento: true }
    });

    if (!tiposEntrada || tiposEntrada.length === 0) {
      return res.status(404).json({ error: "No se encontraron tipos de entrada para este evento" });
    }

    res.json(tiposEntrada);
  } catch (error) {
    console.error("Error al obtener tipos de entrada por evento:", error);
    res.status(500).json({ error: "Error al obtener tipos de entrada por evento" });
  }
};