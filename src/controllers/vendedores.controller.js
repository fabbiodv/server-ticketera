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

    // Obtener vendedor por QR
    const vendedorProfile = await getVendedorByQR(qrCode);

    // Obtener eventos de la productora del vendedor
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

        // Filtros adicionales dinámicos
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

    // Filtrar solo eventos con tipos de entrada disponibles
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

    // Crear pagos
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

    // Crear preferencia de MercadoPago
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