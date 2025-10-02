import { PrismaClient, estadoPago } from '@prisma/client';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import crypto from 'crypto';

const prisma = new PrismaClient();

const mercadopago = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

export const getAllPayments = async (req, res) => {
  try {
    const {
      page, limit, sortBy = 'createdAt', sortOrder = 'desc',
      userId, entradaId, status, paymentMethod,
      minAmount, maxAmount, createdFrom, createdTo,
      ...otherFilters
    } = req.query;

    const payments = await prisma.payment.findMany({
      where: {
        ...(userId && { userId: parseInt(userId) }),
        ...(entradaId && { entradaId: parseInt(entradaId) }),
        ...(status && { status }),
        ...(paymentMethod && { paymentMethod }),
        ...((minAmount || maxAmount) && {
          amount: {
            ...(minAmount && { gte: parseFloat(minAmount) }),
            ...(maxAmount && { lte: parseFloat(maxAmount) })
          }
        }),
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
        user: { select: { name: true, email: true } },
        entrada: {
          include: {
            evento: { select: { name: true, date: true } },
            tipoEntrada: { select: { nombre: true } }
          }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      ...(limit && {
        skip: ((parseInt(page) || 1) - 1) * parseInt(limit),
        take: parseInt(limit)
      })
    });

    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener pagos: ' + error.message });
  }
};

export const getVentasByVendedor = async (req, res) => {
  try {
    const { vendedorId } = req.params;
    const {
      page, limit, sortBy = 'createdAt', sortOrder = 'desc',
      status, eventoId, tipoEntradaId,
      createdFrom, createdTo,
      ...otherFilters
    } = req.query;

    const ventas = await prisma.entrada.findMany({
      where: {
        sellerId: parseInt(vendedorId),
        ...(eventoId && { eventoId: parseInt(eventoId) }),
        ...(tipoEntradaId && { tipoEntradaId: parseInt(tipoEntradaId) }),
        ...(status && {
          payment: { status }
        }),
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
        tipoEntrada: { select: { nombre: true, precio: true } },
        payment: { select: { status: true, amount: true, createdAt: true } }
      },
      orderBy: { [sortBy]: sortOrder },
      ...(limit && {
        skip: ((parseInt(page) || 1) - 1) * parseInt(limit),
        take: parseInt(limit)
      })
    });

    res.json(ventas);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ventas: ' + error.message });
  }
};
// Función para generar QR único
const generateQRCode = () => {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
};


export const generatePaymentLinkByVendedorQR = async (req, res) => {
  const buyerId = req.user?.userId || req.body.buyerId; // Para permitir compras sin auth
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

    // Si no hay buyerId, crear usuario temporal o usar los datos del buyerInfo
    let finalBuyerId = buyerId;
    if (!finalBuyerId && buyerInfo) {
      // Crear usuario temporal o buscar existente
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
            password: 'temp_password' // Password temporal
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

    // Crear múltiples entradas con QR
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
export const generatePaymentLink = async (req, res) => {
  const buyerId = req.user.userId; // Corregir según tu middleware de auth
  const { tipoEntradaId, sellerId, cantidad } = req.body;

  try {
    // Validar vendedor
    const sellerProfiles = await prisma.profile.findMany({
      where: { userId: sellerId },
      include: { roles: true },
    });

    const allowedRoles = ['PUBLICA', 'SUBPUBLICA', 'LIDER'];
    const sellerHasRole = sellerProfiles.some(profile =>
      profile.roles.some(role => allowedRoles.includes(role.role))
    );

    if (!sellerHasRole) {
      return res.status(403).json({ error: 'El vendedor no tiene un rol válido' });
    }

    // Validar tipo de entrada
    const tipoEntrada = await prisma.tipoEntrada.findUnique({
      where: { id: tipoEntradaId },
      include: { evento: true }
    });

    if (!tipoEntrada || !tipoEntrada.disponible) {
      return res.status(400).json({ error: 'Tipo de entrada no disponible' });
    }

    // Verificar límite por persona
    const cantidadEntradasCompradas = await prisma.entrada.count({
      where: {
        buyerId,
        tipoEntradaId,
      },
    });

    if (cantidadEntradasCompradas + cantidad > tipoEntrada.maximoEntradasPorPersona) {
      return res.status(400).json({
        error: 'Ya alcanzaste el límite de entradas para este tipo',
      });
    }

    // Crear múltiples entradas con QR
    const entradas = await Promise.all(
      Array.from({ length: cantidad }).map(() =>
        prisma.entrada.create({
          data: {
            eventoId: tipoEntrada.eventoId,
            tipoEntradaId: tipoEntrada.id,
            buyerId,
            sellerId,
            qrCode: generateQRCode(), // Generar QR único
          },
        })
      )
    );

    // Crear pagos
    const payments = await Promise.all(
      entradas.map((entrada) =>
        prisma.payment.create({
          data: {
            userId: buyerId,
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
        title: `Entrada - ${tipoEntrada.nombre}`,
        quantity: 1,
        currency_id: 'ARS',
        unit_price: tipoEntrada.precio,
      })),
      back_urls: {
        success: `${process.env.FRONTEND_URL}/pago/success`,
        failure: `${process.env.FRONTEND_URL}/pago/failure`,
        pending: `${process.env.FRONTEND_URL}/pago/pending`,
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
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al generar el link de pago' });
  }
};
