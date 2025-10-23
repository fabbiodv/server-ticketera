import { PrismaClient, EstadoEntrada, estadoPago } from '@prisma/client';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import crypto from 'crypto';
import sendEmail from '../config/email.js';
import { purchaseConfirmationTemplate } from '../utils/emailTemplates.js';

const prisma = new PrismaClient();
const mercadopago = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

const generateEntradaQR = () => {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
};

/**
 * Checkout robusto - Flujo completo de compra
 * 1. Valida disponibilidad
 * 2. Reserva entradas temporalmente
 * 3. Crea payment PENDING
 * 4. Genera link de MercadoPago
 * 5. Retorna link para pagar
 */
export const iniciarCheckout = async (req, res) => {
  const buyerId = req.user?.userId || req.body.buyerId;
  const { tipoEntradaId, cantidad, vendedorQR, buyerInfo } = req.body;

  // Validaciones básicas
  if (!tipoEntradaId || !cantidad || cantidad <= 0) {
    return res.status(400).json({ 
      error: 'tipoEntradaId y cantidad son requeridos' 
    });
  }

  const transaction = await prisma.$transaction(async (tx) => {
    try {
      // 1. Obtener información del tipo de entrada
      const tipoEntrada = await tx.tipoEntrada.findUnique({
        where: { id: parseInt(tipoEntradaId) },
        include: {
          evento: {
            include: {
              productora: true
            }
          }
        }
      });

      if (!tipoEntrada) {
        throw new Error('Tipo de entrada no encontrado');
      }

      const entradasDisponibles = await tx.entrada.count({
        where: {
          tipoEntradaId: parseInt(tipoEntradaId),
          estado: EstadoEntrada.DISPONIBLE
        }
      });

      if (entradasDisponibles < cantidad) {
        throw new Error(`Solo hay ${entradasDisponibles} entradas disponibles`);
      }
      let sellerId;
      let vendedorProfile = null;

      if (vendedorQR) {
        vendedorProfile = await tx.profile.findUnique({
          where: { qrCode: vendedorQR },
          include: {
            user: true,
            roles: true
          }
        });

        if (!vendedorProfile) {
          throw new Error('QR de vendedor no válido');
        }
        sellerId = vendedorProfile.userId;
      } else {
        const ownerProfile = await tx.profile.findFirst({
          where: {
            productoraId: tipoEntrada.evento.productoraId,
            roles: {
              some: { role: 'OWNER' }
            }
          }
        });

        if (!ownerProfile) {
          throw new Error('No se encontró vendedor válido');
        }
        sellerId = ownerProfile.userId;
      }

      const reservaHasta = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
      
      const entradasParaReservar = await tx.entrada.findMany({
        where: {
          tipoEntradaId: parseInt(tipoEntradaId),
          estado: EstadoEntrada.DISPONIBLE
        },
        take: cantidad,
        orderBy: { createdAt: 'asc' }
      });

      if (entradasParaReservar.length < cantidad) {
        throw new Error('No hay suficientes entradas disponibles');
      }

      // Actualizar entradas a RESERVADA
      const entradaIds = entradasParaReservar.map(e => e.id);
      await tx.entrada.updateMany({
        where: {
          id: { in: entradaIds }
        },
        data: {
          estado: EstadoEntrada.RESERVADA,
          buyerId: buyerId,
          reservadaHasta: reservaHasta
        }
      });

      // 5. Crear registro de Payment PENDING
      const montoTotal = tipoEntrada.precio * cantidad;
      const payment = await tx.payment.create({
        data: {
          userId: buyerId,
          status: estadoPago.PENDING,
          amount: montoTotal,
          paymentMethod: 'MERCADOPAGO',
          // Podríamos relacionar con las entradas usando external_reference
          entradaId: entradaIds[0], // Por ahora usamos la primera entrada
          metadata: JSON.stringify({
            entradaIds: entradaIds,
            tipoEntradaId: parseInt(tipoEntradaId),
            vendedorQR: vendedorQR,
            buyerInfo: buyerInfo
          })
        }
      });

      // 6. Crear preferencia de MercadoPago
      const preference = new Preference(mercadopago);
      
      const preferenceData = {
        items: [
          {
            id: tipoEntrada.id.toString(),
            title: `${tipoEntrada.nombre} - ${tipoEntrada.evento.name}`,
            quantity: cantidad,
            unit_price: tipoEntrada.precio,
            currency_id: 'ARS'
          }
        ],
        payer: buyerInfo ? {
          name: buyerInfo.name,
          email: buyerInfo.email,
          phone: buyerInfo.phone ? {
            number: buyerInfo.phone
          } : undefined
        } : undefined,
        external_reference: entradaIds.join(','), // IDs de entradas para el webhook
        notification_url: `${process.env.BACKEND_URL}/webhooks/mercadopago`,
        back_urls: {
          success: `${process.env.FRONTEND_URL}/compra/exito?payment_id=${payment.id}`,
          failure: `${process.env.FRONTEND_URL}/compra/fallo?payment_id=${payment.id}`,
          pending: `${process.env.FRONTEND_URL}/compra/pendiente?payment_id=${payment.id}`
        },
        auto_return: 'approved',
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: reservaHasta.toISOString()
      };

      const mpPreference = await preference.create({ body: preferenceData });

      // 7. Actualizar payment con MP preference ID
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          mpPreferenceId: mpPreference.id,
          mpInitPoint: mpPreference.init_point
        }
      });

      return {
        payment,
        mpPreference,
        entradas: entradasParaReservar,
        tipoEntrada,
        reservaHasta
      };

    } catch (error) {
      throw error;
    }
  });

  return res.status(201).json({
    success: true,
    message: 'Checkout iniciado correctamente',
    data: {
      paymentId: transaction.payment.id,
      checkoutUrl: transaction.mpPreference.init_point,
      reservaHasta: transaction.reservaHasta,
      resumen: {
        evento: transaction.tipoEntrada.evento.name,
        tipoEntrada: transaction.tipoEntrada.nombre,
        cantidad: cantidad,
        precioUnitario: transaction.tipoEntrada.precio,
        total: transaction.tipoEntrada.precio * cantidad
      }
    }
  });
};

/**
 * Confirmar pago - Llamado desde webhook de MercadoPago
 * 1. Valida el pago en MercadoPago
 * 2. Actualiza entradas a VENDIDA
 * 3. Actualiza payment a SUCCESS
 * 4. Envía QRs por email
 */
export const confirmarPago = async (paymentId, mpPaymentData) => {
  try {
    const transaction = await prisma.$transaction(async (tx) => {
      // 1. Obtener payment y entradas asociadas
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          user: true
        }
      });

      if (!payment) {
        throw new Error('Payment no encontrado');
      }

      const metadata = JSON.parse(payment.metadata || '{}');
      const entradaIds = metadata.entradaIds || [];

      if (!entradaIds.length) {
        throw new Error('No se encontraron entradas asociadas al pago');
      }

      // 2. Generar QRs únicos para las entradas
      const entradas = await tx.entrada.findMany({
        where: {
          id: { in: entradaIds },
          estado: EstadoEntrada.RESERVADA
        },
        include: {
          tipoEntrada: {
            include: {
              evento: true
            }
          }
        }
      });

      if (entradas.length !== entradaIds.length) {
        throw new Error('Algunas entradas ya no están disponibles');
      }

      // Actualizar entradas con QRs únicos
      const entradasActualizadas = [];
      for (const entrada of entradas) {
        const qrCode = generateEntradaQR();
        const entradaActualizada = await tx.entrada.update({
          where: { id: entrada.id },
          data: {
            estado: EstadoEntrada.VENDIDA,
            qrCode: qrCode
          },
          include: {
            tipoEntrada: {
              include: { evento: true }
            }
          }
        });
        entradasActualizadas.push(entradaActualizada);
      }

      // 3. Actualizar payment a SUCCESS
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: estadoPago.SUCCESS,
          mpPaymentId: mpPaymentData.id?.toString(),
          paymentMethod: mpPaymentData.payment_method_id || 'MERCADOPAGO',
          updatedAt: new Date()
        }
      });

      return { payment, entradas: entradasActualizadas };
    });

    // 4. Enviar email de confirmación con QRs (fuera de la transacción)
    if (transaction.payment.user?.email) {
      const qrCodes = transaction.entradas.map(e => e.qrCode);
      const evento = transaction.entradas[0].tipoEntrada.evento;
      
      await sendEmail({
        to: transaction.payment.user.email,
        subject: `✅ Compra confirmada - ${evento.name}`,
        html: purchaseConfirmationTemplate({
          buyerName: transaction.payment.user.name || 'Usuario',
          eventName: evento.name,
          eventDate: evento.date,
          ticketType: transaction.entradas[0].tipoEntrada.nombre,
          quantity: transaction.entradas.length,
          amount: transaction.payment.amount,
          qrCodes: qrCodes
        })
      });
    }

    return { success: true, payment: transaction.payment };

  } catch (error) {
    console.error('Error al confirmar pago:', error);
    throw error;
  }
};

/**
 * Limpiar reservas expiradas
 * Ejecutar periódicamente para liberar entradas con reservas vencidas
 */
export const limpiarReservasExpiradas = async () => {
  try {
    const ahora = new Date();
    
    const entradasExpiradas = await prisma.entrada.updateMany({
      where: {
        estado: EstadoEntrada.RESERVADA,
        reservadaHasta: {
          lt: ahora
        }
      },
      data: {
        estado: EstadoEntrada.DISPONIBLE,
        buyerId: null,
        reservadaHasta: null
      }
    });

    console.log(`Liberadas ${entradasExpiradas.count} entradas con reservas expiradas`);
    return entradasExpiradas.count;
  } catch (error) {
    console.error('Error al limpiar reservas expiradas:', error);
    throw error;
  }
};

/**
 * Cancelar pago - Para pagos fallidos o expirados
 */
export const cancelarPago = async (paymentId, motivo = 'Pago cancelado') => {
  try {
    const transaction = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId }
      });

      if (!payment) {
        throw new Error('Payment no encontrado');
      }

      const metadata = JSON.parse(payment.metadata || '{}');
      const entradaIds = metadata.entradaIds || [];

      // Liberar entradas reservadas
      if (entradaIds.length > 0) {
        await tx.entrada.updateMany({
          where: {
            id: { in: entradaIds },
            estado: EstadoEntrada.RESERVADA
          },
          data: {
            estado: EstadoEntrada.DISPONIBLE,
            buyerId: null,
            reservadaHasta: null
          }
        });
      }

      // Actualizar payment a FAILURE
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: estadoPago.FAILURE,
          failureReason: motivo,
          updatedAt: new Date()
        }
      });

      return updatedPayment;
    });

    return { success: true, payment: transaction };
  } catch (error) {
    console.error('Error al cancelar pago:', error);
    throw error;
  }
};

export default {
  iniciarCheckout,
  confirmarPago,
  cancelarPago,
  limpiarReservasExpiradas
};