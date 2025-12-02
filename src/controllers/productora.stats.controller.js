import prisma from '../config/database.js';

// Obtener estadísticas completas de la productora
export const getEstadisticasProductora = async (req, res) => {
  try {
    const { productoraId } = req.params;
    const userId = req.user.userId;
    const { period = '30', dateFrom, dateTo } = req.query;

    // Verificar permisos del usuario
    const userProfile = await prisma.profile.findFirst({
      where: {
        userId: userId,
        productoraId: parseInt(productoraId),
        roles: {
          some: {
            role: { in: ['OWNER', 'LIDER', 'ORGANIZADOR'] }
          }
        }
      }
    });

    if (!userProfile) {
      return res.status(403).json({
        error: 'No tienes permisos para ver estadísticas de esta productora'
      });
    }

    // Configurar rango de fechas
    let fechaInicio, fechaFin;
    if (dateFrom && dateTo) {
      fechaInicio = new Date(dateFrom);
      fechaFin = new Date(dateTo);
    } else {
      fechaFin = new Date();
      fechaInicio = new Date();
      fechaInicio.setDate(fechaInicio.getDate() - parseInt(period));
    }

    // Obtener productora básica
    const productora = await prisma.productora.findUnique({
      where: { id: parseInt(productoraId) },
      select: { id: true, name: true, code: true }
    });

    if (!productora) {
      return res.status(404).json({ error: 'Productora no encontrada' });
    }

    // 1. VENTAS TOTALES
    const ventasTotales = await prisma.payment.aggregate({
      where: {
        status: 'SUCCESS',
        entrada: {
          evento: {
            productoraId: parseInt(productoraId)
          }
        },
        createdAt: {
          gte: fechaInicio,
          lte: fechaFin
        }
      },
      _sum: { amount: true },
      _count: { id: true }
    });

    // 2. EVENTOS ACTIVOS
    const eventosActivos = await prisma.eventos.count({
      where: {
        productoraId: parseInt(productoraId),
        status: { in: ['ACTIVO', 'CASI_AGOTADO'] },
        date: {
          gte: new Date()
        }
      }
    });

    // 3. ENTRADAS VENDIDAS
    const entradasVendidas = await prisma.entrada.count({
      where: {
        evento: {
          productoraId: parseInt(productoraId)
        },
        payment: {
          status: 'SUCCESS'
        },
        createdAt: {
          gte: fechaInicio,
          lte: fechaFin
        }
      }
    });

    // 4. CLIENTES ACTIVOS (compradores únicos)
    const clientesActivos = await prisma.entrada.findMany({
      where: {
        evento: {
          productoraId: parseInt(productoraId)
        },
        payment: {
          status: 'SUCCESS'
        },
        createdAt: {
          gte: fechaInicio,
          lte: fechaFin
        }
      },
      select: {
        buyerId: true
      },
      distinct: ['buyerId']
    });

    // 5. VENTAS POR EVENTOS (para gráfico)
    const ventasPorEventos = await prisma.eventos.findMany({
      where: {
        productoraId: parseInt(productoraId),
        date: {
          gte: fechaInicio,
          lte: fechaFin
        }
      },
      select: {
        id: true,
        name: true,
        date: true,
        Entrada: {
          where: {
            payment: {
              status: 'SUCCESS'
            }
          },
          include: {
            payment: {
              select: { amount: true }
            }
          }
        }
      }
    });

    const ventasPorEventosProcessed = ventasPorEventos.map(evento => ({
      eventoId: evento.id,
      eventoNombre: evento.name,
      fecha: evento.date,
      entradasVendidas: evento.Entrada.length,
      montoTotal: evento.Entrada.reduce((sum, entrada) => 
        sum + (entrada.payment?.amount || 0), 0
      )
    }));

    // 6. VENTAS RECIENTES (últimas 10 transacciones)
    const ventasRecientes = await prisma.payment.findMany({
      where: {
        status: 'SUCCESS',
        entrada: {
          evento: {
            productoraId: parseInt(productoraId)
          }
        }
      },
      include: {
        entrada: {
          include: {
            evento: {
              select: { name: true, date: true }
            },
            buyer: {
              select: { name: true, email: true }
            },
            tipoEntrada: {
              select: { nombre: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    const ventasRecientesProcessed = ventasRecientes.map(payment => ({
      id: payment.id,
      monto: payment.amount,
      fecha: payment.createdAt,
      evento: payment.entrada.evento.name,
      comprador: payment.entrada.buyer?.name || 'Sin nombre',
      tipoEntrada: payment.entrada.tipoEntrada.nombre,
      mpPaymentId: payment.mpPaymentId
    }));

    // 7. PRÓXIMOS EVENTOS
    const proximosEventos = await prisma.eventos.findMany({
      where: {
        productoraId: parseInt(productoraId),
        date: {
          gte: new Date()
        },
        status: { in: ['ACTIVO', 'CASI_AGOTADO'] }
      },
      select: {
        id: true,
        name: true,
        date: true,
        location: true,
        status: true,
        tipoEntrada: {
          select: {
            id: true,
            nombre: true,
            precio: true,
            disponible: true,
            maximoEntradasPorPersona: true
          }
        },
        Entrada: {
          where: {
            payment: {
              status: 'SUCCESS'
            }
          },
          select: { id: true }
        }
      },
      orderBy: { date: 'asc' },
      take: 5
    });

    const proximosEventosProcessed = proximosEventos.map(evento => ({
      id: evento.id,
      nombre: evento.name,
      fecha: evento.date,
      ubicacion: evento.location,
      status: evento.status,
      tiposEntrada: evento.tipoEntrada.length,
      entradasVendidas: evento.Entrada.length,
      ingresosPotenciales: evento.tipoEntrada.reduce((sum, tipo) => 
        sum + tipo.precio, 0
      )
    }));

    // 8. ESTADÍSTICAS DE VENDEDORES
    const estadisticasVendedores = await prisma.profile.findMany({
      where: {
        productoraId: parseInt(productoraId),
        roles: {
          some: {
            role: { in: ['PUBLICA', 'SUBPUBLICA', 'LIDER'] }
          }
        }
      },
      include: {
        user: {
          include: {
            entradasVendidas: {
              where: {
                payment: {
                  status: 'SUCCESS'
                },
                createdAt: {
                  gte: fechaInicio,
                  lte: fechaFin
                }
              },
              include: {
                payment: {
                  select: { amount: true }
                }
              }
            }
          }
        },
        roles: {
          select: { role: true }
        }
      }
    });

    const topVendedores = estadisticasVendedores
      .map(profile => {
        const ventas = profile.user.entradasVendidas || [];
        return {
          vendedorId: profile.id,
          nombre: profile.user.name,
          email: profile.user.email,
          roles: profile.roles.map(r => r.role),
          ventasCount: ventas.length,
          ventasTotal: ventas.reduce((sum, entrada) => 
            sum + (entrada.payment?.amount || 0), 0
          )
        };
      })
      .sort((a, b) => b.ventasTotal - a.ventasTotal)
      .slice(0, 5);

    // Respuesta final
    res.json({
      productora,
      periodo: {
        fechaInicio,
        fechaFin,
        dias: Math.ceil((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24))
      },
      estadisticas: {
        ventasTotales: {
          monto: ventasTotales._sum.amount || 0,
          cantidad: ventasTotales._count || 0
        },
        eventosActivos: eventosActivos,
        entradasVendidas: entradasVendidas,
        clientesActivos: clientesActivos.length,
        ventasPorEventos: ventasPorEventosProcessed,
        ventasRecientes: ventasRecientesProcessed,
        proximosEventos: proximosEventosProcessed,
        topVendedores: topVendedores
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas de productora:', error);
    res.status(500).json({
      error: 'Error al obtener estadísticas: ' + error.message
    });
  }
};

// Obtener estadísticas resumidas (más rápidas)
export const getEstadisticasResumidas = async (req, res) => {
  try {
    const { productoraId } = req.params;
    const userId = req.user.userId;

    // Verificar permisos
    const userProfile = await prisma.profile.findFirst({
      where: {
        userId: userId,
        productoraId: parseInt(productoraId),
        roles: {
          some: {
            role: { in: ['OWNER', 'LIDER', 'ORGANIZADOR'] }
          }
        }
      }
    });

    if (!userProfile) {
      return res.status(403).json({
        error: 'No tienes permisos para ver estadísticas de esta productora'
      });
    }

    // Obtener solo métricas básicas
    const [ventasTotal, eventosActivos, entradasVendidas, clientesUnicos] = await Promise.all([
      // Ventas totales (último mes)
      prisma.payment.aggregate({
        where: {
          status: 'SUCCESS',
          entrada: {
            evento: { productoraId: parseInt(productoraId) }
          },
          createdAt: {
            gte: new Date(new Date().setDate(new Date().getDate() - 30))
          }
        },
        _sum: { amount: true }
      }),

      // Eventos activos
      prisma.eventos.count({
        where: {
          productoraId: parseInt(productoraId),
          status: { in: ['ACTIVO', 'CASI_AGOTADO'] },
          date: { gte: new Date() }
        }
      }),

      // Entradas vendidas (último mes)
      prisma.entrada.count({
        where: {
          evento: { productoraId: parseInt(productoraId) },
          payment: { status: 'SUCCESS' },
          createdAt: {
            gte: new Date(new Date().setDate(new Date().getDate() - 30))
          }
        }
      }),

      // Clientes únicos (último mes)
      prisma.entrada.findMany({
        where: {
          evento: { productoraId: parseInt(productoraId) },
          payment: { status: 'SUCCESS' },
          createdAt: {
            gte: new Date(new Date().setDate(new Date().getDate() - 30))
          }
        },
        select: { buyerId: true },
        distinct: ['buyerId']
      })
    ]);

    res.json({
      ventasTotales: ventasTotal._sum.amount || 0,
      eventosActivos: eventosActivos,
      entradasVendidas: entradasVendidas,
      clientesActivos: clientesUnicos.length
    });

  } catch (error) {
    console.error('Error al obtener estadísticas resumidas:', error);
    res.status(500).json({
      error: 'Error al obtener estadísticas resumidas: ' + error.message
    });
  }
};