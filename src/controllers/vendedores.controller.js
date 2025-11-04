import prisma from '../config/database.js';
import { asignarQRToProfile, getVendedorByQR } from '../services/generateVendedorQr.services.js';


export const getEventosDisponiblesByQR = async (req, res) => {
  try {
    const { qrCode } = req.params;
    const {
      sortBy = 'date', sortOrder = 'asc',
      name, location, dateFrom, dateTo,
      ...otherFilters
    } = req.query;

    const vendedorProfile = await getVendedorByQR(qrCode);

    const eventos = await prisma.eventos.findMany({
      where: {
        productoraId: vendedorProfile.productoraId,
        date: { gte: new Date() },
        ...(name && { name: { contains: name, mode: 'insensitive' } }),
        ...(location && { location: { contains: location, mode: 'insensitive' } }),
        ...((dateFrom || dateTo) && {
          date: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(dateTo) })
          }
        }),

        ...Object.fromEntries(
          Object.entries(otherFilters)
            .filter(([_, value]) => value)
            .map(([key, value]) => [key, { contains: value, mode: 'insensitive' }])
        )
      },
      include: {
        tipoEntrada: {
          where: {
            disponible: true,
            estado: 'DISPONIBLE'
          }
        },
        productora: {
          select: { name: true, code: true }
        }
      },
      orderBy: { [sortBy]: sortOrder }
    });

    const eventosConEntradas = eventos.filter(evento => 
      evento.tipoEntrada.length > 0
    );

    res.json({
      vendedor: {
        name: vendedorProfile.user.name,
        productora: vendedorProfile.productora.name
      },
      eventos: eventosConEntradas
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener eventos: ' + error.message });
  }
};

export const getMisVendedores = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      page, limit, sortBy = 'createdAt', sortOrder = 'desc',
      name, email, hasQR, role, productoraId,
      ...otherFilters
    } = req.query;

    const misProductoras = await prisma.profile.findMany({
      where: {
        userId: userId,
        roles: {
          some: { 
            role: { in: ['OWNER', 'LIDER'] }
          }
        }
      },
      select: { productoraId: true }
    });

    if (misProductoras.length === 0) {
      return res.status(403).json({ 
        error: 'No tienes permisos para ver vendedores. Debes ser OWNER o LIDER de al menos una productora.' 
      });
    }

    const productoraIds = misProductoras.map(p => p.productoraId);

    const whereClause = {
      productoraId: { in: productoraIds },
      roles: {
        some: {
          role: { in: ['PUBLICA', 'SUBPUBLICA', 'LIDER'] }
        }
      },
      ...(productoraId && { productoraId: parseInt(productoraId) }),
      ...(hasQR === 'true' && { qrCode: { not: null } }),
      ...(hasQR === 'false' && { qrCode: null }),
      ...(role && {
        roles: { some: { role } }
      }),
      ...(name && {
        user: { name: { contains: name, mode: 'insensitive' } }
      }),
      ...(email && {
        user: { email: { contains: email, mode: 'insensitive' } }
      }),

      // Filtros adicionales dinámicos
      ...Object.fromEntries(
        Object.entries(otherFilters)
          .filter(([_, value]) => value)
          .map(([key, value]) => [key, { contains: value, mode: 'insensitive' }])
      )
    };

    // Obtener vendedores de mis productoras
    const vendedores = await prisma.profile.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, email: true, status: true }
        },
        roles: true,
        productora: {
          select: { id: true, name: true, code: true }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      ...(limit && {
        skip: ((parseInt(page) || 1) - 1) * parseInt(limit),
        take: parseInt(limit)
      })
    });

    // Contar total para paginación
    const total = await prisma.profile.count({
      where: whereClause
    });

    res.json({
      vendedores,
      misProductoras: productoraIds,
      pagination: {
        total,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || total,
        totalPages: limit ? Math.ceil(total / parseInt(limit)) : 1
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener mis vendedores: ' + error.message });
  }
};

export const getAllVendedores = async (req, res) => {
  try {
    const {
      page, limit, sortBy = 'createdAt', sortOrder = 'desc',
      name, email, hasQR, role, productoraId,
      ...otherFilters
    } = req.query;

    const vendedores = await prisma.profile.findMany({
      where: {
        roles: {
          some: {
            role: { in: ['PUBLICA', 'SUBPUBLICA', 'LIDER'] }
          }
        },
        ...(productoraId && { productoraId: parseInt(productoraId) }),
        ...(hasQR === 'true' && { qrCode: { not: null } }),
        ...(hasQR === 'false' && { qrCode: null }),
        ...(role && {
          roles: { some: { role } }
        }),
        ...(name && {
          user: { name: { contains: name, mode: 'insensitive' } }
        }),
        ...(email && {
          user: { email: { contains: email, mode: 'insensitive' } }
        }),

        // Filtros adicionales dinámicos
        ...Object.fromEntries(
          Object.entries(otherFilters)
            .filter(([_, value]) => value)
            .map(([key, value]) => [key, { contains: value, mode: 'insensitive' }])
        )
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, status: true }
        },
        roles: true,
        productora: {
          select: { id: true, name: true, code: true }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      ...(limit && {
        skip: ((parseInt(page) || 1) - 1) * parseInt(limit),
        take: parseInt(limit)
      })
    });

    // Contar total para paginación
    const total = await prisma.profile.count({
      where: {
        roles: {
          some: {
            role: { in: ['PUBLICA', 'SUBPUBLICA', 'LIDER'] }
          }
        },
        ...(productoraId && { productoraId: parseInt(productoraId) }),
        ...(hasQR === 'true' && { qrCode: { not: null } }),
        ...(hasQR === 'false' && { qrCode: null }),
        ...(role && {
          roles: { some: { role } }
        }),
        ...(name && {
          user: { name: { contains: name, mode: 'insensitive' } }
        }),
        ...(email && {
          user: { email: { contains: email, mode: 'insensitive' } }
        })
      }
    });

    res.json({
      vendedores,
      pagination: {
        total,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || total,
        totalPages: limit ? Math.ceil(total / parseInt(limit)) : 1
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener todos los vendedores: ' + error.message });
  }
};

export const getVendedoresProductora = async (req, res) => {
  try {
    const { productoraId } = req.params;
    const {
      page, limit, sortBy = 'createdAt', sortOrder = 'desc',
      name, email, hasQR, role,
      ...otherFilters
    } = req.query;

    const vendedores = await prisma.profile.findMany({
      where: {
        productoraId: parseInt(productoraId),
        roles: {
          some: {
            role: { in: ['PUBLICA', 'SUBPUBLICA', 'LIDER'] }
          }
        },
        ...(hasQR === 'true' && { qrCode: { not: null } }),
        ...(hasQR === 'false' && { qrCode: null }),
        ...(role && {
          roles: { some: { role } }
        }),
        ...(name && {
          user: { name: { contains: name, mode: 'insensitive' } }
        }),
        ...(email && {
          user: { email: { contains: email, mode: 'insensitive' } }
        }),

        // Filtros adicionales dinámicos
        ...Object.fromEntries(
          Object.entries(otherFilters)
            .filter(([_, value]) => value)
            .map(([key, value]) => [key, { contains: value, mode: 'insensitive' }])
        )
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, status: true }
        },
        roles: true,
        productora: {
          select: { name: true, code: true }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      ...(limit && {
        skip: ((parseInt(page) || 1) - 1) * parseInt(limit),
        take: parseInt(limit)
      })
    });

    res.json(vendedores);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener vendedores: ' + error.message });
  }
};
// Generar o obtener QR de un perfil vendedor
export const generarQRVendedor = async (req, res) => {
  try {
    const { profileId } = req.params;

    const qrCode = await asignarQRToProfile(parseInt(profileId));

    res.json({
      profileId: parseInt(profileId),
      qrCode,
      url: `${process.env.FRONTEND_URL}/vendedor/${qrCode}`,
      message: 'QR de vendedor generado exitosamente'
    });

  } catch (error) {
    console.error('Error al generar QR:', error);
    res.status(400).json({ 
      error: error.message || 'Error al generar QR del vendedor' 
    });
  }
};

export const generatePaymentLinkByVendedorQR = async (req, res) => {
  const buyerId = req.user?.userId || req.body.buyerId;
  const { tipoEntradaId, vendedorQR, cantidad, buyerInfo } = req.body;

  try {
    // Obtener vendedor por QR
    const vendedorProfile = await getVendedorByQR(vendedorQR);
    const sellerId = vendedorProfile.user.id;

    // Validar tipo de entrada
    const tipoEntrada = await prisma.tipoEntrada.findUnique({
      where: { id: tipoEntradaId },
      include: { evento: true }
    });

    if (!tipoEntrada || !tipoEntrada.disponible) {
      return res.status(400).json({ error: 'Tipo de entrada no disponible' });
    }

    // Verificar que el evento pertenezca a la productora del vendedor
    if (tipoEntrada.evento.productoraId !== vendedorProfile.productoraId) {
      return res.status(403).json({ error: 'El vendedor no puede vender entradas de este evento' });
    }

    // Manejar usuario comprador
    let finalBuyerId = buyerId;
    if (!finalBuyerId && buyerInfo) {
      const existingUser = await prisma.user.findUnique({
        where: { email: buyerInfo.email }
      });

      if (existingUser) {
        finalBuyerId = existingUser.id;
      } else {
        const newUser = await prisma.user.create({
          data: {
            name: buyerInfo.name,
            email: buyerInfo.email,
            password: 'temp_password'
          }
        });
        finalBuyerId = newUser.id;
      }
    }

    if (!finalBuyerId) {
      return res.status(400).json({ error: 'Información del comprador requerida' });
    }

    // Verificar límite por persona
    const cantidadEntradasCompradas = await prisma.entrada.count({
      where: {
        buyerId: finalBuyerId,
        tipoEntradaId,
      },
    });

    if (cantidadEntradasCompradas + cantidad > tipoEntrada.maximoEntradasPorPersona) {
      return res.status(400).json({
        error: 'Ya alcanzaste el límite de entradas para este tipo',
      });
    }

    // Crear entradas con QR
    const entradas = await Promise.all(
      Array.from({ length: cantidad }).map(() =>
        prisma.entrada.create({
          data: {
            eventoId: tipoEntrada.eventoId,
            tipoEntradaId: tipoEntrada.id,
            buyerId: finalBuyerId,
            sellerId,
            qrCode: generateQRCode(),
          },
        })
      )
    );

    const payments = await Promise.all(
      entradas.map((entrada) =>
        prisma.payment.create({
          data: {
            userId: finalBuyerId,
            entradaId: entrada.id,
            amount: tipoEntrada.precio,
            status: estadoPago.PENDING,
          },
        })
      )
    );

    const preference = new Preference(mercadopago);
    const preferenceData = {
      items: entradas.map((entrada) => ({
        title: `${tipoEntrada.evento.name} - ${tipoEntrada.nombre}`,
        quantity: 1,
        currency_id: 'ARS',
        unit_price: tipoEntrada.precio,
      })),
      payer: buyerInfo ? {
        name: buyerInfo.name,
        email: buyerInfo.email,
        phone: buyerInfo.phone || {}
      } : undefined,
      back_urls: {
        success: `${process.env.FRONTEND_URL}/pago/success?vendedor=${vendedorQR}`,
        failure: `${process.env.FRONTEND_URL}/pago/failure?vendedor=${vendedorQR}`,
        pending: `${process.env.FRONTEND_URL}/pago/pending?vendedor=${vendedorQR}`,
      },
      notification_url: `${process.env.API_URL}/webhooks/mercadopago`,
      auto_return: 'approved',
      external_reference: entradas.map((e) => e.id).join(','),
    };

    const response = await preference.create({ body: preferenceData });

    return res.status(201).json({
      init_point: response.init_point,
      paymentIds: payments.map(p => p.id),
      entradaIds: entradas.map(e => e.id),
      qrCodes: entradas.map(e => e.qrCode),
      vendedor: {
        name: vendedorProfile.user.name,
        productora: vendedorProfile.productora.name
      },
      evento: {
        name: tipoEntrada.evento.name,
        date: tipoEntrada.evento.date
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al generar el link de pago' });
  }
};

// Obtener vendedor completo con todas sus relaciones
export const getVendedorCompleto = async (req, res) => {
  try {
    const { vendedorId } = req.params;
    const userId = req.user.userId;

    let vendedor = await prisma.profile.findUnique({
      where: { id: parseInt(vendedorId) },
      include: {
        user: {
          select: { 
            id: true, 
            name: true, 
            lastName: true,
            email: true, 
            phone: true,
            dni: true,
            status: true,
            createdAt: true,
            lastLogin: true
          }
        },
        roles: true,
        productora: {
          select: { 
            id: true, 
            name: true, 
            code: true,
            description: true,
            email: true,
            phone: true
          }
        },
        entradasVendidas: {
          include: {
            tipoEntrada: {
              include: {
                evento: {
                  select: { 
                    id: true,
                    name: true, 
                    date: true,
                    location: true,
                    status: true
                  }
                }
              }
            },
            buyer: {
              select: { 
                id: true,
                name: true, 
                email: true 
              }
            },
            payments: {
              select: {
                id: true,
                amount: true,
                status: true,
                createdAt: true,
                mpPaymentId: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!vendedor) {
      vendedor = await prisma.profile.findFirst({
        where: { 
          userId: parseInt(vendedorId),
          roles: {
            some: {
              role: { in: ['PUBLICA', 'SUBPUBLICA', 'LIDER', 'OWNER'] }
            }
          }
        },
        include: {
          user: {
            select: { 
              id: true, 
              name: true, 
              lastName: true,
              email: true, 
              phone: true,
              dni: true,
              status: true,
              createdAt: true,
              lastLogin: true
            }
          },
          roles: true,
          productora: {
            select: { 
              id: true, 
              name: true, 
              code: true,
              description: true,
              email: true,
              phone: true
            }
          },
          entradasVendidas: {
            include: {
              tipoEntrada: {
                include: {
                  evento: {
                    select: { 
                      id: true,
                      name: true, 
                      date: true,
                      location: true,
                      status: true
                    }
                  }
                }
              },
              buyer: {
                select: { 
                  id: true,
                  name: true, 
                  email: true 
                }
              },
              payments: {
                select: {
                  id: true,
                  amount: true,
                  status: true,
                  createdAt: true,
                  mpPaymentId: true
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      });
    }

    if (!vendedor) {
      return res.status(404).json({ error: 'Vendedor no encontrado' });
    }

    const isOwn = vendedor.userId === userId;
    
    const hasPermission = await prisma.profile.findFirst({
      where: {
        userId: userId,
        productoraId: vendedor.productoraId,
        roles: {
          some: {
            role: { in: ['OWNER', 'LIDER'] }
          }
        }
      }
    });

    if (!isOwn && !hasPermission) {
      return res.status(403).json({ 
        error: 'No tienes permisos para ver el detalle de este vendedor' 
      });
    }

    let vendedoresSubordinados = [];
    const roles = vendedor.roles.map(r => r.role);

    if (roles.includes('LIDER')) {
      vendedoresSubordinados = await prisma.profile.findMany({
        where: {
          productoraId: vendedor.productoraId,
          id: { not: vendedor.id }, 
          roles: {
            some: {
              role: { in: ['PUBLICA', 'SUBPUBLICA'] }
            }
          }
        },
        include: {
          user: {
            select: { 
              id: true, 
              name: true, 
              lastName: true,
              email: true,
              status: true
            }
          },
          roles: true,
          entradasVendidas: {
            select: { id: true },
            where: {
              createdAt: {
                gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) // Este mes
              }
            }
          }
        }
      });
    } else if (roles.includes('PUBLICA')) {
      vendedoresSubordinados = await prisma.profile.findMany({
        where: {
          productoraId: vendedor.productoraId,
          roles: {
            some: {
              role: 'SUBPUBLICA',
              assignedBy: vendedor.id 
            }
          }
        },
        include: {
          user: {
            select: { 
              id: true, 
              name: true, 
              lastName: true,
              email: true,
              status: true
            }
          },
          roles: true,
          entradasVendidas: {
            select: { id: true },
            where: {
              createdAt: {
                gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) // Este mes
              }
            }
          }
        }
      });
    }

    const ventasStats = {
      totalVentas: vendedor.entradasVendidas.length,
      ventasEsteMes: vendedor.entradasVendidas.filter(entrada => {
        const fechaVenta = new Date(entrada.createdAt);
        const ahora = new Date();
        return fechaVenta.getMonth() === ahora.getMonth() && 
               fechaVenta.getFullYear() === ahora.getFullYear();
      }).length,
      montoTotal: vendedor.entradasVendidas.reduce((sum, entrada) => {
        const pagoAprobado = entrada.payments.find(p => p.status === 'APPROVED');
        return sum + (pagoAprobado ? pagoAprobado.amount : 0);
      }, 0),
      montoEsteMes: vendedor.entradasVendidas
        .filter(entrada => {
          const fechaVenta = new Date(entrada.createdAt);
          const ahora = new Date();
          return fechaVenta.getMonth() === ahora.getMonth() && 
                 fechaVenta.getFullYear() === ahora.getFullYear();
        })
        .reduce((sum, entrada) => {
          const pagoAprobado = entrada.payments.find(p => p.status === 'APPROVED');
          return sum + (pagoAprobado ? pagoAprobado.amount : 0);
        }, 0)
    };

    const subordinadosStats = vendedoresSubordinados.map(sub => ({
      id: sub.id,
      user: sub.user,
      roles: sub.roles.map(r => r.role),
      ventasEsteMes: sub.entradasVendidas.length
    }));

    res.json({
      vendedor: {
        id: vendedor.id,
        user: vendedor.user,
        roles: vendedor.roles,
        productora: vendedor.productora,
        qrCode: vendedor.qrCode,
        createdAt: vendedor.createdAt,
        updatedAt: vendedor.updatedAt
      },
      estadisticas: ventasStats,
      entradasVendidas: vendedor.entradasVendidas.slice(0, 10), // Últimas 10 ventas
      vendedoresSubordinados: subordinadosStats,
      resumen: {
        esLider: roles.includes('LIDER'),
        esPublica: roles.includes('PUBLICA'),
        esSubpublica: roles.includes('SUBPUBLICA'),
        esOwner: roles.includes('OWNER'),
        tieneQR: !!vendedor.qrCode,
        cantidadSubordinados: vendedoresSubordinados.length,
        productoraNombre: vendedor.productora.name
      }
    });
    
  } catch (error) {
    console.error('Error al obtener vendedor completo:', error);
    res.status(500).json({ error: 'Error al obtener información del vendedor: ' + error.message });
  }
};