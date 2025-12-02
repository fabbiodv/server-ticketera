import prisma from '../config/database.js';
import { asignarQRToProfile, getVendedorByQR } from '../services/generateVendedorQr.services.js';
import sendEmail from '../config/email.js';
import { invitationTemplate } from '../utils/invitationTemplate.js';
import crypto from 'crypto';


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
      include, // Parámetro para incluir datos adicionales
      ...otherFilters
    } = req.query;

    // Parsear includes
    const includes = include ? include.split(',').map(i => i.trim()) : [];
    const includePhone = includes.includes('phone');
    const includeTotalSales = includes.includes('totalSales');
    const includeSalesCount = includes.includes('salesCount');
    const includeSubVendors = includes.includes('subVendors');

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

    // Construir la consulta base
    const baseInclude = {
      user: {
        select: { 
          id: true, 
          name: true, 
          email: true, 
          status: true,
          ...(includePhone && { phone: true })
        }
      },
      roles: true,
      productora: {
        select: { id: true, name: true, code: true }
      }
    };

    // Agregar ventas si se solicitan
    if (includeTotalSales || includeSalesCount) {
      baseInclude.user.include = {
        entradasVendidas: {
          include: {
            payment: {
              select: { amount: true, status: true }
            }
          }
        }
      };
    }

    // Obtener vendedores de mis productoras
    const vendedores = await prisma.profile.findMany({
      where: whereClause,
      include: baseInclude,
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

    // Procesar datos adicionales si se solicitan
    const vendedoresProcessed = await Promise.all(
      vendedores.map(async (vendedor) => {
        const vendedorData = { ...vendedor };

        // Agregar datos de ventas si se solicitan
        if (includeTotalSales || includeSalesCount) {
          const ventas = vendedor.user.entradasVendidas || [];
          
          if (includeSalesCount) {
            vendedorData.salesCount = ventas.length;
          }

          if (includeTotalSales) {
            vendedorData.totalSales = ventas.reduce((total, entrada) => {
              if (entrada.payment && entrada.payment.status === 'SUCCESS') {
                return total + entrada.payment.amount;
              }
              return total;
            }, 0);
          }

          // Limpiar datos innecesarios si no se necesitan en el output
          if (vendedorData.user.entradasVendidas) {
            delete vendedorData.user.entradasVendidas;
          }
        }

        // Agregar subvendedores si se solicitan
        if (includeSubVendors) {
          const roles = vendedor.roles.map(r => r.role);
          
          if (roles.includes('LIDER')) {
            // Si es LIDER, obtener PUBLICA y SUBPUBLICA de su productora
            vendedorData.subVendors = await prisma.profile.findMany({
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
                  select: { id: true, name: true, email: true }
                },
                roles: {
                  select: { role: true }
                }
              }
            });
          } else if (roles.includes('PUBLICA')) {
            // Si es PUBLICA, obtener SUBPUBLICA relacionadas
            vendedorData.subVendors = await prisma.profile.findMany({
              where: {
                productoraId: vendedor.productoraId,
                id: { not: vendedor.id },
                roles: {
                  some: {
                    role: 'SUBPUBLICA'
                  }
                }
              },
              include: {
                user: {
                  select: { id: true, name: true, email: true }
                },
                roles: {
                  select: { role: true }
                }
              }
            });
          } else {
            vendedorData.subVendors = [];
          }
        }

        return vendedorData;
      })
    );

    res.json({
      vendedores: vendedoresProcessed,
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
      include, // Parámetro para incluir datos adicionales
      ...otherFilters
    } = req.query;

    // Parsear includes
    const includes = include ? include.split(',').map(i => i.trim()) : [];
    const includePhone = includes.includes('phone');
    const includeTotalSales = includes.includes('totalSales');
    const includeSalesCount = includes.includes('salesCount');
    const includeSubVendors = includes.includes('subVendors');

    // Construir la consulta base
    const baseInclude = {
      user: {
        select: { 
          id: true, 
          name: true, 
          email: true, 
          status: true,
          ...(includePhone && { phone: true })
        }
      },
      roles: true,
      productora: {
        select: { id: true, name: true, code: true }
      }
    };

    // Agregar ventas si se solicitan
    if (includeTotalSales || includeSalesCount) {
      baseInclude.user.include = {
        entradasVendidas: {
          include: {
            payment: {
              select: { amount: true, status: true }
            }
          }
        }
      };
    }

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
      include: baseInclude,
      orderBy: { [sortBy]: sortOrder },
      ...(limit && {
        skip: ((parseInt(page) || 1) - 1) * parseInt(limit),
        take: parseInt(limit)
      })
    });

    // Procesar datos adicionales si se solicitan
    const vendedoresProcessed = await Promise.all(
      vendedores.map(async (vendedor) => {
        const vendedorData = { ...vendedor };

        // Agregar datos de ventas si se solicitan
        if (includeTotalSales || includeSalesCount) {
          const ventas = vendedor.user.entradasVendidas || [];
          
          if (includeSalesCount) {
            vendedorData.salesCount = ventas.length;
          }

          if (includeTotalSales) {
            vendedorData.totalSales = ventas.reduce((total, entrada) => {
              if (entrada.payment && entrada.payment.status === 'SUCCESS') {
                return total + entrada.payment.amount;
              }
              return total;
            }, 0);
          }

          // Limpiar datos innecesarios si no se necesitan en el output
          if (vendedorData.user.entradasVendidas) {
            delete vendedorData.user.entradasVendidas;
          }
        }

        // Agregar subvendedores si se solicitan
        if (includeSubVendors) {
          const roles = vendedor.roles.map(r => r.role);
          
          if (roles.includes('LIDER')) {
            // Si es LIDER, obtener PUBLICA y SUBPUBLICA de su productora
            vendedorData.subVendors = await prisma.profile.findMany({
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
                  select: { id: true, name: true, email: true }
                },
                roles: {
                  select: { role: true }
                }
              }
            });
          } else if (roles.includes('PUBLICA')) {
            // Si es PUBLICA, obtener SUBPUBLICA relacionadas
            vendedorData.subVendors = await prisma.profile.findMany({
              where: {
                productoraId: vendedor.productoraId,
                id: { not: vendedor.id },
                roles: {
                  some: {
                    role: 'SUBPUBLICA'
                  }
                }
              },
              include: {
                user: {
                  select: { id: true, name: true, email: true }
                },
                roles: {
                  select: { role: true }
                }
              }
            });
          } else {
            vendedorData.subVendors = [];
          }
        }

        return vendedorData;
      })
    );

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
      vendedores: vendedoresProcessed,
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
      include, // Parámetro para incluir datos adicionales
      ...otherFilters
    } = req.query;

    // Parsear includes
    const includes = include ? include.split(',').map(i => i.trim()) : [];
    const includePhone = includes.includes('phone');
    const includeTotalSales = includes.includes('totalSales');
    const includeSalesCount = includes.includes('salesCount');
    const includeSubVendors = includes.includes('subVendors');

    // Construir la consulta base
    const baseInclude = {
      user: {
        select: { 
          id: true, 
          name: true, 
          email: true, 
          status: true,
          ...(includePhone && { phone: true })
        }
      },
      roles: true,
      productora: {
        select: { name: true, code: true }
      }
    };

    // Agregar ventas si se solicitan
    if (includeTotalSales || includeSalesCount) {
      baseInclude.user.include = {
        entradasVendidas: {
          include: {
            payment: {
              select: { amount: true, status: true }
            }
          }
        }
      };
    }

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
      include: baseInclude,
      orderBy: { [sortBy]: sortOrder },
      ...(limit && {
        skip: ((parseInt(page) || 1) - 1) * parseInt(limit),
        take: parseInt(limit)
      })
    });

    // Procesar datos adicionales si se solicitan
    const vendedoresProcessed = await Promise.all(
      vendedores.map(async (vendedor) => {
        const vendedorData = { ...vendedor };

        // Agregar datos de ventas si se solicitan
        if (includeTotalSales || includeSalesCount) {
          const ventas = vendedor.user.entradasVendidas || [];
          
          if (includeSalesCount) {
            vendedorData.salesCount = ventas.length;
          }

          if (includeTotalSales) {
            vendedorData.totalSales = ventas.reduce((total, entrada) => {
              if (entrada.payment && entrada.payment.status === 'SUCCESS') {
                return total + entrada.payment.amount;
              }
              return total;
            }, 0);
          }

          // Limpiar datos innecesarios si no se necesitan en el output
          if (vendedorData.user.entradasVendidas) {
            delete vendedorData.user.entradasVendidas;
          }
        }

        // Agregar subvendedores si se solicitan
        if (includeSubVendors) {
          const roles = vendedor.roles.map(r => r.role);
          
          if (roles.includes('LIDER')) {
            // Si es LIDER, obtener PUBLICA y SUBPUBLICA de su productora
            vendedorData.subVendors = await prisma.profile.findMany({
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
                  select: { id: true, name: true, email: true }
                },
                roles: {
                  select: { role: true }
                }
              }
            });
          } else if (roles.includes('PUBLICA')) {
            // Si es PUBLICA, obtener SUBPUBLICA relacionadas
            vendedorData.subVendors = await prisma.profile.findMany({
              where: {
                productoraId: vendedor.productoraId,
                id: { not: vendedor.id },
                roles: {
                  some: {
                    role: 'SUBPUBLICA'
                  }
                }
              },
              include: {
                user: {
                  select: { id: true, name: true, email: true }
                },
                roles: {
                  select: { role: true }
                }
              }
            });
          } else {
            vendedorData.subVendors = [];
          }
        }

        return vendedorData;
      })
    );

    res.json(vendedoresProcessed);
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
          include: {
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
                payment: {
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
        },
        roles: true,
        productora: {
          select: { 
            id: true, 
            name: true, 
            code: true,
            email: true,
          }
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
            include: {
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
                  payment: {
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
          },
          roles: true,
          productora: {
            select: { 
              id: true, 
              name: true, 
              code: true,
              email: true,
            }
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
            include: {
              entradasVendidas: {
                select: { id: true },
                where: {
                  createdAt: {
                    gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) // Este mes
                  }
                }
              }
            }
          },
          roles: true
        }
      });
    } else if (roles.includes('PUBLICA')) {
      vendedoresSubordinados = await prisma.profile.findMany({
        where: {
          productoraId: vendedor.productoraId,
          id: { not: vendedor.id },
          roles: {
            some: {
              role: 'SUBPUBLICA'
            }
          }
        },
        include: {
          user: {
            include: {
              entradasVendidas: {
                select: { id: true },
                where: {
                  createdAt: {
                    gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) // Este mes
                  }
                }
              }
            }
          },
          roles: true
        }
      });
    }

    const ventasStats = {
      totalVentas: vendedor.user.entradasVendidas.length,
      ventasEsteMes: vendedor.user.entradasVendidas.filter(entrada => {
        const fechaVenta = new Date(entrada.createdAt);
        const ahora = new Date();
        return fechaVenta.getMonth() === ahora.getMonth() && 
               fechaVenta.getFullYear() === ahora.getFullYear();
      }).length,
      montoTotal: vendedor.user.entradasVendidas.reduce((sum, entrada) => {
        const pagoAprobado = entrada.payment && entrada.payment.status === 'APPROVED';
        return sum + (pagoAprobado ? entrada.payment.amount : 0);
      }, 0),
      montoEsteMes: vendedor.user.entradasVendidas
        .filter(entrada => {
          const fechaVenta = new Date(entrada.createdAt);
          const ahora = new Date();
          return fechaVenta.getMonth() === ahora.getMonth() && 
                 fechaVenta.getFullYear() === ahora.getFullYear();
        })
        .reduce((sum, entrada) => {
          const pagoAprobado = entrada.payment && entrada.payment.status === 'APPROVED';
          return sum + (pagoAprobado ? entrada.payment.amount : 0);
        }, 0)
    };

    const subordinadosStats = vendedoresSubordinados.map(sub => ({
      id: sub.id,
      user: sub.user,
      roles: sub.roles.map(r => r.role),
      ventasEsteMes: sub.user.entradasVendidas.length
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
      entradasVendidas: vendedor.user.entradasVendidas.slice(0, 10), // Últimas 10 ventas
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


// Helper functions
const findVendedorByIdModular = async (vendedorId) => {
  let vendedor = await prisma.profile.findUnique({
    where: { id: parseInt(vendedorId) },
    include: {
      user: {
        include: {
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
              payment: {
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
      },
      roles: true,
      productora: {
        select: { 
          id: true, 
          name: true, 
          code: true,
          email: true,
        }
      }
    }
  });

  // Si no se encontró por profileId, buscar por userId
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
        roles: true,
        productora: {
          select: { 
            id: true, 
            name: true, 
            code: true,
            email: true,
          }
        },
        user: {
          include: {
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
                payment: {
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
        }
      }
    });
  }
  
  return vendedor;
};

const checkVendedorPermissionsModular = async (vendedor, userId) => {
  const isOwn = vendedor.userId === userId;
  
  if (isOwn) return true;
  
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
  
  return !!hasPermission;
};

const getVendedoresSubordinadosModular = async (vendedor) => {
  let vendedoresSubordinados = [];
  const roles = vendedor.roles.map(r => r.role);

  if (roles.includes('LIDER')) {
    // Si es LIDER, puede ver PUBLICA y SUBPUBLICA de su productora
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
          include: {
            entradasVendidas: {
              select: { id: true },
              where: {
                createdAt: {
                  gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                }
              }
            }
          }
        },
        roles: true
      }
    });
  } else if (roles.includes('PUBLICA')) {
    // Si es PUBLICA, puede ver sus SUBPUBLICA (por ahora solo de la misma productora)
    // TODO: Implementar relación assignedBy cuando se agregue al esquema
    vendedoresSubordinados = await prisma.profile.findMany({
      where: {
        productoraId: vendedor.productoraId,
        id: { not: vendedor.id },
        roles: {
          some: {
            role: 'SUBPUBLICA'
          }
        }
      },
      include: {
        user: {
          include: {
            entradasVendidas: {
              select: { id: true },
              where: {
                createdAt: {
                  gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                }
              }
            }
          }
        },
        roles: true
      }
    });
  }
  
  return vendedoresSubordinados;
};

const calculateVentasStatsModular = (entradasVendidas) => {
  return {
    totalVentas: entradasVendidas.length,
    ventasEsteMes: entradasVendidas.filter(entrada => {
      const fechaVenta = new Date(entrada.createdAt);
      const ahora = new Date();
      return fechaVenta.getMonth() === ahora.getMonth() && 
             fechaVenta.getFullYear() === ahora.getFullYear();
    }).length,
    montoTotal: entradasVendidas.reduce((sum, entrada) => {
      const pagoAprobado = entrada.payment && entrada.payment.status === 'APPROVED';
      return sum + (pagoAprobado ? entrada.payment.amount : 0);
    }, 0),
    montoEsteMes: entradasVendidas
      .filter(entrada => {
        const fechaVenta = new Date(entrada.createdAt);
        const ahora = new Date();
        return fechaVenta.getMonth() === ahora.getMonth() && 
               fechaVenta.getFullYear() === ahora.getFullYear();
      })
      .reduce((sum, entrada) => {
        const pagoAprobado = entrada.payment && entrada.payment.status === 'APPROVED';
        return sum + (pagoAprobado ? entrada.payment.amount : 0);
      }, 0)
  };
};

const getSubordinadosStatsModular = (vendedoresSubordinados) => {
  return vendedoresSubordinados.map(sub => ({
    id: sub.id,
    user: sub.user,
    roles: sub.roles.map(r => r.role),
    ventasEsteMes: sub.user.entradasVendidas.length
  }));
};

// Asignar rol PUBLICA a un usuario (solo LIDER puede hacerlo)
// Asignar rol LIDER a un usuario (solo OWNER puede hacerlo)
// Enviar invitación por email para unirse a la ticketera
export const enviarInvitacion = async (req, res) => {
  try {
    const { email, role } = req.body;
    const inviterUserId = req.user.userId;

    // Validar que el rol sea válido
    const rolesPermitidos = ['LIDER', 'PUBLICA', 'SUBPUBLICA', 'ORGANIZADOR'];
    if (!rolesPermitidos.includes(role)) {
      return res.status(400).json({ 
        error: 'Rol no válido. Roles permitidos: LIDER, PUBLICA, SUBPUBLICA, ORGANIZADOR' 
      });
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email no válido' });
    }

    // Verificar permisos del inviter
    const inviterProfile = await prisma.profile.findFirst({
      where: {
        userId: inviterUserId,
        roles: {
          some: {
            role: { in: ['OWNER', 'LIDER'] }
          }
        }
      },
      include: {
        user: {
          select: { name: true, email: true }
        },
        productora: {
          select: { id: true, name: true, code: true }
        },
        roles: true
      }
    });

    if (!inviterProfile) {
      return res.status(403).json({ 
        error: 'Solo los OWNERS o LIDERES pueden enviar invitaciones' 
      });
    }

    // Verificar permisos específicos por rol
    const inviterRoles = inviterProfile.roles.map(r => r.role);
    if (role === 'LIDER' && !inviterRoles.includes('OWNER')) {
      return res.status(403).json({ 
        error: 'Solo los OWNERS pueden invitar LIDERES' 
      });
    }

    // Verificar si el usuario ya existe y ya tiene un perfil en esta productora
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        profiles: {
          where: {
            productoraId: inviterProfile.productora.id
          },
          include: {
            roles: true
          }
        }
      }
    });

    if (existingUser && existingUser.profiles.length > 0) {
      return res.status(400).json({ 
        error: 'Este usuario ya forma parte de tu productora' 
      });
    }

    // Verificar si ya existe una invitación pendiente
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email,
        productoraId: inviterProfile.productora.id,
        role,
        status: 'PENDING',
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (existingInvitation) {
      return res.status(400).json({ 
        error: 'Ya existe una invitación pendiente para este email y rol' 
      });
    }

    // Generar token único
    const token = crypto.randomBytes(32).toString('hex');
    
    // Crear invitación
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Expira en 24 horas

    const invitation = await prisma.invitation.create({
      data: {
        email,
        role,
        token,
        productoraId: inviterProfile.productora.id,
        invitedBy: inviterUserId,
        expiresAt,
        status: 'PENDING'
      },
      include: {
        productora: {
          select: { name: true, code: true }
        },
        inviter: {
          select: { name: true, email: true }
        }
      }
    });

    // Crear link de invitación
    const invitationLink = `${process.env.FRONTEND_URL}/invitation/accept/${token}`;

    // Preparar datos para el email
    const emailData = {
      inviterName: inviterProfile.user.name || 'Ticketera',
      productoraNombre: inviterProfile.productora.name,
      role: role,
      invitationLink: invitationLink,
      expiresAt: expiresAt
    };

    // Enviar email
    const emailHtml = invitationTemplate(emailData);
    
    await sendEmail({
      to: email,
      subject: `Invitación a ${inviterProfile.productora.name} - Ticketera`,
      html: emailHtml
    });

    res.status(201).json({
      message: 'Invitación enviada exitosamente',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        productora: invitation.productora.name,
        invitedBy: invitation.inviter.name,
        expiresAt: invitation.expiresAt,
        status: invitation.status
      }
    });

  } catch (error) {
    console.error('Error al enviar invitación:', error);
    res.status(500).json({ 
      error: 'Error al enviar invitación: ' + error.message 
    });
  }
};

// Listar invitaciones enviadas
export const getInvitacionesEnviadas = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, limit = 20, page = 1 } = req.query;

    // Verificar que el usuario tiene permisos
    const userProfile = await prisma.profile.findFirst({
      where: {
        userId: userId,
        roles: {
          some: {
            role: { in: ['OWNER', 'LIDER'] }
          }
        }
      },
      include: {
        productora: true
      }
    });

    if (!userProfile) {
      return res.status(403).json({ 
        error: 'Solo los OWNERS o LIDERES pueden ver invitaciones' 
      });
    }

    const whereClause = {
      productoraId: userProfile.productoraId,
      ...(status && { status })
    };

    const invitations = await prisma.invitation.findMany({
      where: whereClause,
      include: {
        inviter: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    const total = await prisma.invitation.count({ where: whereClause });

    res.json({
      invitations,
      productora: userProfile.productora.name,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error al obtener invitaciones:', error);
    res.status(500).json({ 
      error: 'Error al obtener invitaciones: ' + error.message 
    });
  }
};

// Cancelar invitación
export const cancelarInvitacion = async (req, res) => {
  try {
    const { invitationId } = req.params;
    const userId = req.user.userId;

    // Buscar la invitación
    const invitation = await prisma.invitation.findUnique({
      where: { id: parseInt(invitationId) },
      include: {
        productora: true,
        inviter: {
          select: { id: true, name: true }
        }
      }
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitación no encontrada' });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ 
        error: 'Solo se pueden cancelar invitaciones pendientes' 
      });
    }

    // Verificar permisos
    const userProfile = await prisma.profile.findFirst({
      where: {
        userId: userId,
        productoraId: invitation.productoraId,
        roles: {
          some: {
            role: { in: ['OWNER', 'LIDER'] }
          }
        }
      }
    });

    if (!userProfile) {
      return res.status(403).json({ 
        error: 'No tienes permisos para cancelar esta invitación' 
      });
    }

    // Cancelar la invitación
    await prisma.invitation.update({
      where: { id: parseInt(invitationId) },
      data: { 
        status: 'CANCELLED',
        updatedAt: new Date()
      }
    });

    res.json({
      message: 'Invitación cancelada exitosamente',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: 'CANCELLED'
      }
    });

  } catch (error) {
    console.error('Error al cancelar invitación:', error);
    res.status(500).json({ 
      error: 'Error al cancelar invitación: ' + error.message 
    });
  }
};

export const asignarLider = async (req, res) => {
  try {
    const { userId: targetUserId } = req.body;
    const ownerUserId = req.user.userId;

    // Verificar que el usuario actual es OWNER
    const ownerProfile = await prisma.profile.findFirst({
      where: {
        userId: ownerUserId,
        roles: {
          some: {
            role: 'OWNER'
          }
        }
      },
      include: {
        productora: true
      }
    });

    if (!ownerProfile) {
      return res.status(403).json({ 
        error: 'Solo los OWNERS pueden asignar roles LIDER' 
      });
    }

    // Verificar que el usuario target existe
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Buscar o crear el perfil del usuario en la productora
    let targetProfile = await prisma.profile.findFirst({
      where: {
        userId: targetUserId,
        productoraId: ownerProfile.productoraId
      },
      include: {
        roles: true
      }
    });

    if (!targetProfile) {
      // Crear nuevo perfil si no existe
      targetProfile = await prisma.profile.create({
        data: {
          userId: targetUserId,
          productoraId: ownerProfile.productoraId
        },
        include: {
          roles: true
        }
      });
    }

    // Verificar si ya tiene el rol LIDER
    const yaEsLider = targetProfile.roles.some(role => role.role === 'LIDER');
    
    if (yaEsLider) {
      return res.status(400).json({ 
        error: 'El usuario ya tiene el rol LIDER en esta productora' 
      });
    }

    // Asignar el rol LIDER
    await prisma.roleAsignee.create({
      data: {
        profileId: targetProfile.id,
        role: 'LIDER'
      }
    });

    // Obtener el perfil actualizado
    const updatedProfile = await prisma.profile.findUnique({
      where: { id: targetProfile.id },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        roles: true,
        productora: {
          select: { name: true, code: true }
        }
      }
    });

    res.status(201).json({
      message: 'Rol LIDER asignado exitosamente',
      profile: updatedProfile,
      asignadoPor: {
        id: ownerProfile.id,
        user: ownerProfile.user?.name || 'OWNER',
        productora: ownerProfile.productora.name
      }
    });

  } catch (error) {
    console.error('Error al asignar rol LIDER:', error);
    res.status(500).json({ 
      error: 'Error al asignar rol LIDER: ' + error.message 
    });
  }
};

export const asignarPublica = async (req, res) => {
  try {
    const { userId: targetUserId } = req.body;
    const liderUserId = req.user.userId;

    // Verificar que el usuario actual es LIDER
    const liderProfile = await prisma.profile.findFirst({
      where: {
        userId: liderUserId,
        roles: {
          some: {
            role: 'LIDER'
          }
        }
      },
      include: {
        productora: true
      }
    });

    if (!liderProfile) {
      return res.status(403).json({ 
        error: 'Solo los LIDERES pueden asignar roles PUBLICA' 
      });
    }

    // Verificar que el usuario target existe
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Buscar o crear el perfil del usuario en la productora
    let targetProfile = await prisma.profile.findFirst({
      where: {
        userId: targetUserId,
        productoraId: liderProfile.productoraId
      },
      include: {
        roles: true
      }
    });

    if (!targetProfile) {
      // Crear nuevo perfil si no existe
      targetProfile = await prisma.profile.create({
        data: {
          userId: targetUserId,
          productoraId: liderProfile.productoraId
        },
        include: {
          roles: true
        }
      });
    }

    // Verificar si ya tiene el rol PUBLICA
    const yaEsPublica = targetProfile.roles.some(role => role.role === 'PUBLICA');
    
    if (yaEsPublica) {
      return res.status(400).json({ 
        error: 'El usuario ya tiene el rol PUBLICA en esta productora' 
      });
    }

    // Asignar el rol PUBLICA
    await prisma.roleAsignee.create({
      data: {
        profileId: targetProfile.id,
        role: 'PUBLICA'
      }
    });

    // Obtener el perfil actualizado
    const updatedProfile = await prisma.profile.findUnique({
      where: { id: targetProfile.id },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        roles: true,
        productora: {
          select: { name: true, code: true }
        }
      }
    });

    res.status(201).json({
      message: 'Rol PUBLICA asignado exitosamente',
      profile: updatedProfile,
      asignadoPor: {
        id: liderProfile.id,
        user: liderProfile.user?.name || 'LIDER',
        productora: liderProfile.productora.name
      }
    });

  } catch (error) {
    console.error('Error al asignar rol PUBLICA:', error);
    res.status(500).json({ 
      error: 'Error al asignar rol PUBLICA: ' + error.message 
    });
  }
};

// Asignar rol SUBPUBLICA a un usuario (LIDER o PUBLICA pueden hacerlo)
export const asignarSubpublica = async (req, res) => {
  try {
    const { userId: targetUserId } = req.body;
    const assignerUserId = req.user.userId;

    // Verificar que el usuario actual es LIDER o PUBLICA
    const assignerProfile = await prisma.profile.findFirst({
      where: {
        userId: assignerUserId,
        roles: {
          some: {
            role: { in: ['LIDER', 'PUBLICA'] }
          }
        }
      },
      include: {
        productora: true,
        roles: true
      }
    });

    if (!assignerProfile) {
      return res.status(403).json({ 
        error: 'Solo los LIDERES o PUBLICAS pueden asignar roles SUBPUBLICA' 
      });
    }

    // Verificar que el usuario target existe
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Buscar o crear el perfil del usuario en la productora
    let targetProfile = await prisma.profile.findFirst({
      where: {
        userId: targetUserId,
        productoraId: assignerProfile.productoraId
      },
      include: {
        roles: true
      }
    });

    if (!targetProfile) {
      // Crear nuevo perfil si no existe
      targetProfile = await prisma.profile.create({
        data: {
          userId: targetUserId,
          productoraId: assignerProfile.productoraId
        },
        include: {
          roles: true
        }
      });
    }

    // Verificar si ya tiene el rol SUBPUBLICA
    const yaEsSubpublica = targetProfile.roles.some(role => role.role === 'SUBPUBLICA');
    
    if (yaEsSubpublica) {
      return res.status(400).json({ 
        error: 'El usuario ya tiene el rol SUBPUBLICA en esta productora' 
      });
    }

    // Asignar el rol SUBPUBLICA
    await prisma.roleAsignee.create({
      data: {
        profileId: targetProfile.id,
        role: 'SUBPUBLICA'
      }
    });

    // Obtener el perfil actualizado
    const updatedProfile = await prisma.profile.findUnique({
      where: { id: targetProfile.id },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        roles: true,
        productora: {
          select: { name: true, code: true }
        }
      }
    });

    const assignerRoles = assignerProfile.roles.map(r => r.role);
    
    res.status(201).json({
      message: 'Rol SUBPUBLICA asignado exitosamente',
      profile: updatedProfile,
      asignadoPor: {
        id: assignerProfile.id,
        roles: assignerRoles,
        productora: assignerProfile.productora.name
      }
    });

  } catch (error) {
    console.error('Error al asignar rol SUBPUBLICA:', error);
    res.status(500).json({ 
      error: 'Error al asignar rol SUBPUBLICA: ' + error.message 
    });
  }
};

// Listar usuarios disponibles para asignar roles
// Remover rol de un usuario (solo LIDER puede remover PUBLICA, LIDER y PUBLICA pueden remover SUBPUBLICA)
export const removerRol = async (req, res) => {
  try {
    const { profileId, role } = req.body;
    const removerUserId = req.user.userId;

    if (!['LIDER', 'PUBLICA', 'SUBPUBLICA'].includes(role)) {
      return res.status(400).json({ 
        error: 'Solo se pueden remover roles LIDER, PUBLICA y SUBPUBLICA' 
      });
    }

    // Verificar permisos del usuario que quiere remover
    const removerProfile = await prisma.profile.findFirst({
      where: {
        userId: removerUserId,
        roles: {
          some: {
            role: { in: ['OWNER', 'LIDER', 'PUBLICA'] }
          }
        }
      },
      include: {
        roles: true,
        productora: true
      }
    });

    if (!removerProfile) {
      return res.status(403).json({ 
        error: 'Solo los OWNERS, LIDERES o PUBLICAS pueden remover roles' 
      });
    }

    // Verificar permisos específicos
    const removerRoles = removerProfile.roles.map(r => r.role);
    
    if (role === 'LIDER' && !removerRoles.includes('OWNER')) {
      return res.status(403).json({ 
        error: 'Solo los OWNERS pueden remover el rol LIDER' 
      });
    }
    
    if (role === 'PUBLICA' && !removerRoles.includes('LIDER') && !removerRoles.includes('OWNER')) {
      return res.status(403).json({ 
        error: 'Solo los OWNERS o LIDERES pueden remover el rol PUBLICA' 
      });
    }

    // Obtener el perfil objetivo
    const targetProfile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        roles: true,
        productora: {
          select: { name: true, code: true }
        }
      }
    });

    if (!targetProfile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    // Verificar que está en la misma productora
    if (targetProfile.productoraId !== removerProfile.productoraId) {
      return res.status(403).json({ 
        error: 'No puedes remover roles de usuarios de otras productoras' 
      });
    }

    // Buscar el rol específico a remover
    const roleToRemove = await prisma.roleAsignee.findFirst({
      where: {
        profileId: profileId,
        role: role
      }
    });

    if (!roleToRemove) {
      return res.status(404).json({ 
        error: `El usuario no tiene el rol ${role} asignado` 
      });
    }

    // Remover el rol usando la clave primaria compuesta
    await prisma.roleAsignee.delete({
      where: {
        profileId_role: {
          profileId: profileId,
          role: role
        }
      }
    });

    // Obtener el perfil actualizado
    const updatedProfile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        roles: true,
        productora: {
          select: { name: true, code: true }
        }
      }
    });

    res.json({
      message: `Rol ${role} removido exitosamente`,
      profile: updatedProfile,
      removidoPor: {
        id: removerProfile.id,
        roles: removerRoles,
        productora: removerProfile.productora.name
      }
    });

  } catch (error) {
    console.error('Error al remover rol:', error);
    res.status(500).json({ 
      error: 'Error al remover rol: ' + error.message 
    });
  }
};

// Listar miembros actuales de la productora
export const getMiembrosProductora = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { role, search, limit = 20 } = req.query;

    // Verificar que el usuario actual es LIDER
    const liderProfile = await prisma.profile.findFirst({
      where: {
        userId: userId,
        roles: {
          some: {
            role: { in: ['LIDER', 'OWNER'] }
          }
        }
      },
      include: {
        productora: true
      }
    });

    if (!liderProfile) {
      return res.status(403).json({ 
        error: 'Solo los LIDERES u OWNERS pueden ver miembros de la productora' 
      });
    }

    // Obtener miembros de la productora
    const miembros = await prisma.profile.findMany({
      where: {
        productoraId: liderProfile.productoraId,
        ...(role && {
          roles: {
            some: { role }
          }
        }),
        ...(search && {
          user: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } }
            ]
          }
        })
      },
      include: {
        user: {
          select: { 
            id: true, 
            name: true, 
            email: true, 
            status: true 
          }
        },
        roles: {
          select: {
            role: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: [
        { createdAt: 'desc' }
      ],
      take: parseInt(limit)
    });

    // Agregar información adicional sobre cada miembro
    const miembrosConInfo = miembros.map(miembro => {
      const roles = miembro.roles.map(r => r.role);
      return {
        id: miembro.id,
        user: miembro.user,
        roles: miembro.roles,
        qrCode: miembro.qrCode,
        createdAt: miembro.createdAt,
        info: {
          esLider: roles.includes('LIDER'),
          esPublica: roles.includes('PUBLICA'),
          esSubpublica: roles.includes('SUBPUBLICA'),
          esOwner: roles.includes('OWNER'),
          tieneQR: !!miembro.qrCode,
          puedeVender: roles.some(r => ['PUBLICA', 'SUBPUBLICA', 'LIDER'].includes(r))
        }
      };
    });

    res.json({
      miembros: miembrosConInfo,
      productora: {
        id: liderProfile.productoraId,
        name: liderProfile.productora.name,
        code: liderProfile.productora.code
      },
      total: miembros.length
    });

  } catch (error) {
    console.error('Error al obtener miembros de productora:', error);
    res.status(500).json({ 
      error: 'Error al obtener miembros de la productora: ' + error.message 
    });
  }
};

export const getUsuariosDisponibles = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { search, limit = 10 } = req.query;

    // Verificar que el usuario actual es LIDER o PUBLICA
    const userProfile = await prisma.profile.findFirst({
      where: {
        userId: userId,
        roles: {
          some: {
            role: { in: ['LIDER', 'PUBLICA'] }
          }
        }
      },
      include: {
        productora: true
      }
    });

    if (!userProfile) {
      return res.status(403).json({ 
        error: 'Solo los LIDERES o PUBLICAS pueden ver usuarios disponibles' 
      });
    }

    // Buscar usuarios que no sean parte de esta productora o que no tengan roles específicos
    const usuariosDisponibles = await prisma.user.findMany({
      where: {
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
          ]
        }),
        status: 'ACTIVE',
        profiles: {
          none: {
            productoraId: userProfile.productoraId
          }
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true
      },
      take: parseInt(limit)
    });

    res.json({
      usuarios: usuariosDisponibles,
      productora: {
        id: userProfile.productoraId,
        name: userProfile.productora.name
      }
    });

  } catch (error) {
    console.error('Error al obtener usuarios disponibles:', error);
    res.status(500).json({ 
      error: 'Error al obtener usuarios disponibles: ' + error.message 
    });
  }
};

export const getVendedorCompletoModular = async (req, res) => {
  try {
    const { vendedorId } = req.params;
    const userId = req.user.userId;

    // Buscar vendedor
    const vendedor = await findVendedorByIdModular(vendedorId);
    if (!vendedor) {
      return res.status(404).json({ error: 'Vendedor no encontrado' });
    }

    // Verificar permisos
    const hasPermission = await checkVendedorPermissionsModular(vendedor, userId);
    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'No tienes permisos para ver el detalle de este vendedor' 
      });
    }

    // Obtener vendedores subordinados
    const vendedoresSubordinados = await getVendedoresSubordinadosModular(vendedor);
    
    // Calcular estadísticas
    const ventasStats = calculateVentasStatsModular(vendedor.user.entradasVendidas);
    const subordinadosStats = getSubordinadosStatsModular(vendedoresSubordinados);
    
    // Preparar respuesta
    const roles = vendedor.roles.map(r => r.role);
    
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
      entradasVendidas: vendedor.user.entradasVendidas.slice(0, 10), // Últimas 10 ventas
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
    res.status(500).json({ 
      error: 'Error al obtener información del vendedor: ' + error.message 
    });
  }
};