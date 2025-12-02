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
// Escanear QR de entrada - obtener información sin consumir
export const escanearQREntrada = async (req, res) => {
  try {
    const { qrCode } = req.params;

    const entrada = await prisma.entrada.findUnique({
      where: { qrCode },
      include: {
        evento: {
          select: { 
            id: true,
            name: true, 
            date: true, 
            location: true,
            status: true,
            productora: {
              select: { name: true }
            }
          }
        },
        buyer: {
          select: { 
            id: true,
            name: true, 
            email: true, 
            phone: true 
          }
        },
        seller: {
          select: { 
            id: true,
            name: true, 
            email: true 
          }
        },
        tipoEntrada: {
          select: { 
            id: true,
            nombre: true, 
            precio: true 
          }
        },
        payment: {
          select: {
            id: true,
            status: true,
            amount: true,
            createdAt: true
          }
        }
      }
    });

    if (!entrada) {
      return res.status(404).json({ 
        error: 'Entrada no encontrada',
        valid: false
      });
    }

    // Verificar estado del pago
    const pagoValido = entrada.payment && entrada.payment.status === 'SUCCESS';
    
    if (!pagoValido) {
      return res.status(400).json({
        error: 'Entrada no válida - Pago no confirmado',
        valid: false,
        entrada: {
          qrCode: entrada.qrCode,
          evento: entrada.evento.name,
          paymentStatus: entrada.payment?.status || 'NO_PAYMENT'
        }
      });
    }

    // Verificar fecha del evento
    const now = new Date();
    const eventDate = new Date(entrada.evento.date);
    const hoursDiff = (eventDate - now) / (1000 * 60 * 60);

    let timeStatus = 'VALID';
    let timeMessage = '';
    
    if (hoursDiff > 24) {
      timeStatus = 'TOO_EARLY';
      timeMessage = 'El evento aún no está próximo (más de 24 horas)';
    } else if (hoursDiff < -6) {
      timeStatus = 'TOO_LATE';
      timeMessage = 'El evento ya terminó hace más de 6 horas';
    } else if (hoursDiff < 0) {
      timeStatus = 'EVENT_ENDED';
      timeMessage = 'El evento ya terminó';
    }

    res.json({
      valid: true,
      consumed: entrada.escaneado,
      timeStatus,
      timeMessage,
      canConsume: !entrada.escaneado && pagoValido && timeStatus !== 'TOO_LATE',
      entrada: {
        id: entrada.id,
        qrCode: entrada.qrCode,
        escaneado: entrada.escaneado,
        fechaEscaneo: entrada.updatedAt, // Como referencia de cuándo se modificó
        evento: entrada.evento,
        buyer: entrada.buyer,
        seller: entrada.seller,
        tipoEntrada: entrada.tipoEntrada,
        payment: entrada.payment,
        createdAt: entrada.createdAt
      }
    });

  } catch (error) {
    console.error('Error al escanear QR:', error);
    res.status(500).json({ 
      error: 'Error al escanear QR de entrada: ' + error.message,
      valid: false
    });
  }
};

// Consumir entrada - marcar como usada
export const consumirEntrada = async (req, res) => {
  try {
    const { qrCode } = req.params;
    const { scannedBy, location, notes } = req.body;

    // Buscar la entrada
    const entrada = await prisma.entrada.findUnique({
      where: { qrCode },
      include: {
        evento: {
          select: {
            id: true,
            name: true,
            date: true,
            location: true,
            status: true
          }
        },
        buyer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        payment: {
          select: {
            status: true,
            amount: true
          }
        },
        tipoEntrada: {
          select: {
            nombre: true,
            precio: true
          }
        }
      }
    });

    if (!entrada) {
      return res.status(404).json({ 
        error: 'Entrada no encontrada',
        success: false
      });
    }

    // Verificar si ya fue escaneada
    if (entrada.escaneado) {
      return res.status(400).json({
        error: 'Esta entrada ya fue utilizada',
        success: false,
        consumedAt: entrada.updatedAt,
        entrada: {
          qrCode: entrada.qrCode,
          evento: entrada.evento.name,
          buyer: entrada.buyer.name
        }
      });
    }

    // Verificar estado del pago
    if (!entrada.payment || entrada.payment.status !== 'SUCCESS') {
      return res.status(400).json({
        error: 'Entrada no válida - Pago no confirmado',
        success: false,
        paymentStatus: entrada.payment?.status || 'NO_PAYMENT'
      });
    }

    // Verificar fecha del evento (permitir hasta 6 horas después)
    const now = new Date();
    const eventDate = new Date(entrada.evento.date);
    const hoursDiff = (eventDate - now) / (1000 * 60 * 60);

    if (hoursDiff < -6) {
      return res.status(400).json({
        error: 'Esta entrada ha expirado (evento terminó hace más de 6 horas)',
        success: false,
        eventDate: entrada.evento.date
      });
    }

    // Marcar como escaneada/consumida
    const entradaConsumida = await prisma.entrada.update({
      where: { qrCode },
      data: {
        escaneado: true,
        updatedAt: new Date()
      },
      include: {
        evento: {
          select: {
            name: true,
            date: true,
            location: true
          }
        },
        buyer: {
          select: {
            name: true,
            email: true
          }
        },
        tipoEntrada: {
          select: {
            nombre: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Entrada consumida exitosamente',
      entrada: {
        id: entradaConsumida.id,
        qrCode: entradaConsumida.qrCode,
        consumedAt: entradaConsumida.updatedAt,
        evento: entradaConsumida.evento,
        buyer: entradaConsumida.buyer,
        tipoEntrada: entradaConsumida.tipoEntrada
      }
    });

  } catch (error) {
    console.error('Error al consumir entrada:', error);
    res.status(500).json({ 
      error: 'Error al consumir entrada: ' + error.message,
      success: false
    });
  }
};

// Obtener estadísticas de entradas escaneadas para un evento
export const getEstadisticasEscaneo = async (req, res) => {
  try {
    const { eventoId } = req.params;
    const { date } = req.query;

    const whereClause = {
      eventoId: parseInt(eventoId),
      ...(date && {
        updatedAt: {
          gte: new Date(date + 'T00:00:00'),
          lte: new Date(date + 'T23:59:59')
        },
        escaneado: true // Solo considerar las que fueron escaneadas en esa fecha
      })
    };

    const [total, escaneadas, noEscaneadas, porTipo] = await Promise.all([
      // Total de entradas vendidas
      prisma.entrada.count({
        where: {
          eventoId: parseInt(eventoId),
          payment: {
            status: 'SUCCESS'
          }
        }
      }),
      
      // Entradas escaneadas
      prisma.entrada.count({
        where: {
          ...whereClause,
          escaneado: true
        }
      }),
      
      // Entradas no escaneadas
      prisma.entrada.count({
        where: {
          eventoId: parseInt(eventoId),
          escaneado: false,
          payment: {
            status: 'SUCCESS'
          }
        }
      }),
      
      // Por tipo de entrada
      prisma.entrada.groupBy({
        by: ['tipoEntradaId'],
        where: {
          eventoId: parseInt(eventoId),
          payment: {
            status: 'SUCCESS'
          }
        },
        _count: {
          id: true
        },
        _sum: {
          escaneado: true
        }
      })
    ]);

    // Obtener nombres de tipos de entrada
    const tiposEntrada = await prisma.tipoEntrada.findMany({
      where: {
        id: {
          in: porTipo.map(t => t.tipoEntradaId)
        }
      },
      select: {
        id: true,
        nombre: true
      }
    });

    const estadisticasPorTipo = porTipo.map(stat => {
      const tipo = tiposEntrada.find(t => t.id === stat.tipoEntradaId);
      return {
        tipoEntrada: tipo?.nombre || 'Desconocido',
        total: stat._count.id,
        escaneadas: stat._sum.escaneado || 0,
        pendientes: stat._count.id - (stat._sum.escaneado || 0)
      };
    });

    res.json({
      evento: {
        id: parseInt(eventoId)
      },
      estadisticas: {
        total,
        escaneadas,
        noEscaneadas,
        porcentajeAsistencia: total > 0 ? ((escaneadas / total) * 100).toFixed(2) : 0
      },
      porTipoEntrada: estadisticasPorTipo
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ 
      error: 'Error al obtener estadísticas: ' + error.message 
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