import prisma from "../config/database.js";
import { PrismaClient } from "@prisma/client";
import { createEntrada } from "./entrada.controller.js";
export const createTipoEntrada = async (req, res) => {
  try {
    const prisma = new PrismaClient();
    const { nombre, precio, eventoId, maximoEntradasPorPersona } = req.body;
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
        maximoEntradasPorPersona: Number(maximoEntradasPorPersona),
        
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
    const tiposEntrada = await prisma.tipoEntrada.findMany({
      include: { evento: true }
    });
    res.json(tiposEntrada);
  } catch (error) {
    console.error("Error al obtener tipos de entrada:", error);
    res.status(500).json({ error: "Error al obtener tipos de entrada" });
  }
};
export const getTipoEntradaById = async (req, res) => {
  try {
    const { id } = req.params;
    const tipoEntrada = await prisma.tipoEntrada.findUnique({
      where: { id: Number(id) },
      include: { evento: true }
    });

    if (!tipoEntrada) {
      return res.status(404).json({ error: "Tipo de entrada no encontrado" });
    }

    res.json(tipoEntrada);
  } catch (error) {
    console.error("Error al obtener tipo de entrada:", error);
    res.status(500).json({ error: "Error al obtener tipo de entrada" });
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