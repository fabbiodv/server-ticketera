import { PrismaClient, estadoPago } from '@prisma/client';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import crypto from 'crypto';

const prisma = new PrismaClient();

const mercadopago = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

// Función para generar QR único
const generateQRCode = () => {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
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

// Nuevo endpoint para obtener ventas por vendedor
export const getVentasByVendedor = async (req, res) => {
  try {
    const { vendedorId } = req.params;
    const { fechaInicio, fechaFin } = req.query;

    const where = {
      sellerId: parseInt(vendedorId),
      payment: {
        status: estadoPago.SUCCESS
      }
    };

    if (fechaInicio && fechaFin) {
      where.createdAt = {
        gte: new Date(fechaInicio),
        lte: new Date(fechaFin)
      };
    }

    const ventas = await prisma.entrada.findMany({
      where,
      include: {
        tipoEntrada: {
          include: {
            evento: true
          }
        },
        buyer: {
          select: { id: true, name: true, email: true }
        },
        payment: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const resumen = {
      totalVentas: ventas.length,
      montoTotal: ventas.reduce((sum, venta) => sum + venta.payment.amount, 0),
      ventasPorEvento: ventas.reduce((acc, venta) => {
        const eventoNombre = venta.tipoEntrada.evento.name;
        acc[eventoNombre] = (acc[eventoNombre] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({
      ventas,
      resumen
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener ventas del vendedor' });
  }
};