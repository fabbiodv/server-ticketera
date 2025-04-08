import { PrismaClient } from "@prisma/client/extension";

export const getAllEntradas = async (req, res) => {
  try {
    const prisma = new PrismaClient();
    const entradas = await prisma.entrada.findMany({
      include: {
        evento: true,
        tipoEntrada: true,
      },
    });
    if (!entradas || entradas.length === 0) {
      return res.status(404).json({ message: "No se encontraron entradas" });
    }
    res.status(200).json(entradas);
  } catch (error) {
    // console.error("Error al obtener entradas:", error);
    res.status(500).json({ error: "Error al obtener entradas" });
  }
}
export const getEntradaById = async (req, res) => {
  try {
    const prisma = new PrismaClient();
    const { id } = req.params;
    const entrada = await prisma.entrada.findUnique({
      where: { id: Number(id) },
      include: {
        evento: true,
        tipoEntrada: true,
      },
    });
    if (!entrada) {
      return res.status(404).json({ message: "Entrada no encontrada" });
    }
    res.status(200).json(entrada);
  } catch (error) {
    // console.error("Error al obtener entrada:", error);
    res.status(500).json({ error: "Error al obtener entrada" });
  }
}
export const createEntrada = async (req, res) => {
  try {
    const { nombre, tipoEntradaId, eventoId } = req.body;
    if (!nombre || !tipoEntradaId || !eventoId ) {
      return res.status(400).json({
        error: "Todos los campos son obligatorios: nombre, tipoEntradaId, eventoId"
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
    const tipoEntradaExiste = await prisma.tipoEntrada.findUnique({
      where: { id: Number(tipoEntradaId) }
    });
    if (!tipoEntradaExiste) {
      return res.status(404).json({
        error: "El tipo de entrada especificado no existe"
      });
    }
    const entrada = await prisma.entrada.create({
      data: {
        nombre,
        tipoEntradaId: Number(tipoEntradaId),
        eventoId: Number(eventoId),
      },
      include: {
        evento: true
      }
    });

    res.status(201).json({
      message: "Entrada creada exitosamente",
      entrada
    });

  } catch (error) {
    console.error("Error al crear entrada:", error);
    res.status(500).json({
      error: "Error al crear la entrada",
      details: error.message
    });
  }
}

export const deleteEntrada = async (req, res) => {
  try {
    const prisma = new PrismaClient();
    const { id } = req.params;
    const entrada = await prisma.entrada.delete({
      where: { id: Number(id) },
    });
    res.status(200).json({ message: "Entrada eliminada exitosamente", entrada });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar entrada" });
  }
}   