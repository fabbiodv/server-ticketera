import { MercadoPagoConfig, Payment } from 'mercadopago';
import { PrismaClient, estadoPago } from '@prisma/client';
import { confirmarPago, cancelarPago } from './checkout.controller.js';

const prisma = new PrismaClient();
const mercadopago = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

export const webhookMercadoPago = async (req, res) => {
  const { type, data } = req.body;

  if (type === 'payment') {
    const mpPaymentId = data.id;

    try {
      const payment = new Payment(mercadopago);
      const paymentInfo = await payment.get({ id: mpPaymentId });
      
      const paymentStatus = paymentInfo.status;
      const externalReference = paymentInfo.external_reference;

      console.log(`Webhook MP: Pago ${mpPaymentId}, Estado: ${paymentStatus}, Ref: ${externalReference}`);

      let localPayment = null;
      
      if (paymentInfo.preference_id) {
        localPayment = await prisma.payment.findFirst({
          where: { mpPreferenceId: paymentInfo.preference_id }
        });
      }
      if (!localPayment && externalReference) {
        const entradaIds = externalReference.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
        if (entradaIds.length > 0) {
          localPayment = await prisma.payment.findFirst({
            where: {
              metadata: {
                contains: `"entradaIds":[${entradaIds[0]}`
              }
            }
          });
        }
      }

      if (!localPayment) {
        console.warn(`No se encontró payment local para MP payment ${mpPaymentId}`);
        return res.status(200).send('OK'); 
      }
      switch (paymentStatus) {
        case 'approved':
          await confirmarPago(localPayment.id, paymentInfo);
          console.log(`Pago ${localPayment.id} confirmado exitosamente`);
          break;
          
        case 'rejected':
        case 'cancelled':
          await cancelarPago(localPayment.id, `Pago ${paymentStatus} en MercadoPago`);
          console.log(`Pago ${localPayment.id} cancelado: ${paymentStatus}`);
          break;
          
        case 'pending':
        case 'in_process':
          console.log(`Pago ${localPayment.id} sigue pendiente: ${paymentStatus}`);
          break;
          
        default:
          console.warn(`Estado de pago no manejado: ${paymentStatus}`);
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Error al procesar webhook de MercadoPago:', error);
      res.status(500).send('Error');
    }
  } else {
    res.status(200).send('OK'); 
  }
};