const { PrismaClient, estadoPago } = require('@prisma/client');
const mercadopago = require('../utils/mercadopago');
const prisma = new PrismaClient();

const generatePaymentLink = async (req, res) => {
  const buyerId = req.user.id; // quien compra la entrada
  const { tipoEntradaId, sellerId,cantidad  } = req.body;

  try {
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

    const tipoEntrada = await prisma.tipoEntrada.findUnique({
      where: { id: tipoEntradaId },
    });

    if (!tipoEntrada || !tipoEntrada.disponible) {
      return res.status(400).json({ error: 'Tipo de entrada no disponible' });
    }

    const cantidadEntradasCompradas = await prisma.entrada.count({
      where: {
        buyerId,
        tipoEntradaId,
      },
    });

    if (cantidadEntradasCompradas + cantidad  >= tipoEntrada.maximoEntradasPorPersona) {
      return res.status(400).json({
        error: 'Ya alcanzaste el límite de entradas para este tipo',
      });
    }

 // Crear múltiples entradas
const entradas = await Promise.all(
    Array.from({ length: cantidad }).map(() =>
      prisma.entrada.create({
        data: {
          eventoId: tipoEntrada.eventoId,
          tipoEntradaId: tipoEntrada.id,
          buyerId,
          sellerId,
        },
      })
    )
  );
  
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

  const preference = {
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
  
    const response = await mercadopago.preferences.create(preference);

    return res.status(201).json({
        init_point: response.body.init_point,
        paymentIds: payments.map(p => p.id),
        entradaIds: entradas.map(e => e.id),
      });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al generar el link de pago' });
  }
};

module.exports = {
  generatePaymentLink,
};
