// webhookController.js

import  mercadopago from '../utils/mercadopago';
import  { PrismaClient, estadoPago } from '@prisma/client';
const prisma = new PrismaClient();

const webhookMercadoPago = async (req, res) => {
  const { type, data } = req.body;

  if (type === 'payment') {
    const paymentId = data.id;

    try {
      const paymentInfo = await mercadopago.payment.get(paymentId);
      const paymentStatus = paymentInfo.body.status;
      const externalReference = paymentInfo.body.external_reference;
      const entradaIds = externalReference.split(',');

      console.log(`Notificación de pago ${paymentId}: Estado - ${paymentStatus}`);

      const updatedPayments = await prisma.payment.updateMany({
        where: {
          entradaId: {
            in: entradaIds,
          },
        },
        data: {
          status: paymentStatus === 'approved' ? estadoPago.SUCCESS :
                  paymentStatus === 'rejected' ? estadoPago.FAILURE :
                  paymentStatus === 'pending' ? estadoPago.PENDING :
                  estadoPago.CANCELLED, 
          paymentDate: paymentStatus === 'approved' ? new Date() : null,
          paymentIdOnPlatform: paymentId,
        },
      });

      if (paymentStatus === 'approved') {
        await prisma.entrada.updateMany({
          where: {
            id: {
              in: entradaIds,
            },
          },
          data: {
            estado: 'SUCCESS',
          },
        });
        console.log(`Entradas ${entradaIds.join(', ')} marcadas como pagadas.`);
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Error al procesar la notificación de Mercado Pago:', error);
      res.status(500).send('Error');
    }
  } else {
    res.status(200).send('OK'); 
  }
};

module.exports = {
  webhookMercadoPago,
};