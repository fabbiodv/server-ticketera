import { PrismaClient } from "@prisma/client/extension";
import prisma from '../config/database.js';
import crypto from 'crypto';

const generateEntradaQR = () => {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
};
export const getAllEntradas = async (req, res) => {
  try {
    const {
      page, limit, sortBy = 'createdAt', sortOrder = 'desc',
      eventoId, buyerId, sellerId, tipoEntradaId, escaneado,
      qrCode, createdFrom, createdTo,
      ...otherFilters
    } = req.query;

    const entradas = await prisma.entrada.findMany({
      where: {
        ...(eventoId && { eventoId: parseInt(eventoId) }),
        ...(buyerId && { buyerId: parseInt(buyerId) }),
        ...(sellerId && { sellerId: parseInt(sellerId) }),
        ...(tipoEntradaId && { tipoEntradaId: parseInt(tipoEntradaId) }),
        ...(escaneado !== undefined && { escaneado: escaneado === 'true' }),
        ...(qrCode && { qrCode: { contains: qrCode, mode: 'insensitive' } }),
        ...((createdFrom || createdTo) && {
          createdAt: {
            ...(createdFrom && { gte: new Date(createdFrom) }),
            ...(createdTo && { lte: new Date(createdTo) })
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
        evento: { select: { name: true, date: true } },
        buyer: { select: { name: true, email: true } },
        seller: { select: { name: true, email: true } },
        tipoEntrada: { select: { nombre: true, precio: true } },
        payment: { select: { status: true, amount: true } }
      },
      orderBy: { [sortBy]: sortOrder },
      ...(limit && {
        skip: ((parseInt(page) || 1) - 1) * parseInt(limit),
        take: parseInt(limit)
      })
    });

    res.json(entradas);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener entradas: ' + error.message });
  }
};

export const getEntradaById = async (req, res) => {
  try {
    const { id } = req.params;
    const { includePayment, includeAll } = req.query;

    const entrada = await prisma.entrada.findUnique({
      where: { id: parseInt(id) },
      include: {
        evento: { select: { name: true, date: true, location: true } },
        buyer: { select: { name: true, email: true, phone: true } },
        seller: { select: { name: true, email: true } },
        tipoEntrada: { select: { nombre: true, precio: true } },
        ...(includePayment === 'true' && {
          payment: true
        }),
        ...(includeAll === 'true' && {
          payment: true,
          evento: {
            include: {
              productora: { select: { name: true } }
            }
          }
        })
      }
    });

    if (!entrada) {
      return res.status(404).json({ error: 'Entrada no encontrada' });
    }

    res.json(entrada);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener entrada: ' + error.message });
  }
};
export const createEntrada = async (req, res) => {
  try {
    const { nombre, tipoEntradaId, eventoId, sellerId } = req.body;
    
    if (!nombre || !tipoEntradaId || !eventoId) {
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
    if (sellerId) {
      const sellerExiste = await prisma.user.findUnique({
        where: { id: Number(sellerId) }
      });

      if (!sellerExiste) {
        return res.status(404).json({
          error: "El vendedor especificado no existe"
        });
      }
    }
    const createData = {
      qrCode: generateEntradaQR(),
      escaneado: false,
      evento: {
        connect: { id: Number(eventoId) }
      },
      tipoEntrada: {
        connect: { id: Number(tipoEntradaId) }
      }
    };
    if (sellerId) {
      createData.seller = {
        connect: { id: Number(sellerId) }
      };
    }
    const entrada = await prisma.entrada.create({
      data: createData,
      include: {
        evento: {
          select: {
            id: true,
            name: true,
            date: true,
            location: true
          }
        },
        tipoEntrada: {
          select: {
            id: true,
            nombre: true,
            precio: true
          }
        },
        seller: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
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
};
export const deleteEntrada = async (req, res) => {
  try {
    const { id } = req.params;
    const entrada = await prisma.entrada.delete({
      where: { id: Number(id) },
    });
    res.status(200).json({ message: "Entrada eliminada exitosamente", entrada });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar entrada" + error.message });
  }
}   