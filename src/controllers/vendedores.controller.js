import prisma from '../config/database.js';
import { asignarQRToProfile, getVendedorByQR } from '../services/generateVendedorQr.services.js';

// Obtener eventos disponibles para un vendedor por QR
export const getEventosDisponiblesByQR = async (req, res) => {
  try {
    const { qrCode } = req.params;

    // Obtener vendedor por QR
    const vendedorProfile = await getVendedorByQR(qrCode);

    // Obtener eventos de la productora del vendedor
    const eventos = await prisma.eventos.findMany({
      where: {
        productoraId: vendedorProfile.productoraId,
        date: {
          gte: new Date() // Solo eventos futuros
        }
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
      orderBy: {
        date: 'asc'
      }
    });

    // Filtrar solo eventos con tipos de entrada disponibles
    const eventosConEntradas = eventos.filter(evento => 
      evento.tipoEntrada.length > 0
    );

    res.json({
      vendedor: {
        id: vendedorProfile.user.id,
        name: vendedorProfile.user.name,
        email: vendedorProfile.user.email,
        productora: vendedorProfile.productora.name,
        qrCode: vendedorProfile.qrCode
      },
      eventos: eventosConEntradas.map(evento => ({
        id: evento.id,
        name: evento.name,
        date: evento.date,
        startTime: evento.startTime,
        endTime: evento.endTime,
        description: evento.description,
        location: evento.location,
        capacity: evento.capacity,
        productora: evento.productora.name,
        tiposEntrada: evento.tipoEntrada.map(tipo => ({
          id: tipo.id,
          nombre: tipo.nombre,
          precio: tipo.precio,
          totalEntradas: tipo.totalEntradas,
          maximoEntradasPorPersona: tipo.maximoEntradasPorPersona,
          estado: tipo.estado,
          disponible: tipo.disponible
        }))
      }))
    });

  } catch (error) {
    console.error('Error al obtener eventos:', error);
    res.status(400).json({ 
      error: error.message || 'Error al obtener eventos del vendedor' 
    });
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

// Listar vendedores con sus QR de una productora
export const getVendedoresProductora = async (req, res) => {
  try {
    const { productoraId } = req.params;

    const vendedores = await prisma.profile.findMany({
      where: {
        productoraId: parseInt(productoraId),
        roles: {
          some: {
            role: {
              in: ['PUBLICA', 'SUBPUBLICA', 'LIDER']
            }
          }
        }
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        roles: true
      }
    });

    const vendedoresConQR = vendedores.map(profile => ({
      profileId: profile.id,
      user: profile.user,
      roles: profile.roles.map(r => r.role),
      qrCode: profile.qrCode,
      hasQR: !!profile.qrCode,
      qrUrl: profile.qrCode ? `${process.env.FRONTEND_URL}/vendedor/${profile.qrCode}` : null
    }));

    res.json(vendedoresConQR);

  } catch (error) {
    console.error('Error al obtener vendedores:', error);
    res.status(500).json({ 
      error: 'Error al obtener vendedores de la productora' 
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