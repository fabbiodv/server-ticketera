import { MercadoPagoConfig, Payment } from 'mercadopago';
import { PrismaClient, estadoPago } from '@prisma/client';

const prisma = new PrismaClient();
const mercadopago = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

export const webhookMercadoPago = async (req, res) => {
  const { type, data } = req.body;

  if (type === 'payment') {
    const paymentId = data.id;

    try {
      const payment = new Payment(mercadopago);
      const paymentInfo = await payment.get({ id: paymentId });
      
      const paymentStatus = paymentInfo.status;
      const externalReference = paymentInfo.external_reference;
      const entradaIds = externalReference.split(',').map(id => parseInt(id));

      console.log(`Notificación de pago ${paymentId}: Estado - ${paymentStatus}`);

      // Actualizar pagos
      await prisma.payment.updateMany({
        where: {
          entradaId: {
            in: entradaIds,
          },
        },
        data: {
          status: paymentStatus === 'approved' ? estadoPago.SUCCESS :
                  paymentStatus === 'rejected' ? estadoPago.FAILURE :
                  paymentStatus === 'pending' ? estadoPago.PENDING :
                  estadoPago.FAILURE,
          updatedAt: new Date(),
        },
      });

      res.status(200).send('OK');
    } catch (error) {
      console.error('Error al procesar la notificación de Mercado Pago:', error);
      res.status(500).send('Error');
    }
  } else {
    res.status(200).send('OK'); 
  }
};