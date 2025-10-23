import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { PrismaClient, EstadoEntrada } from '@prisma/client';
import { createTestApp } from '../helpers/testApp.js';

const prisma = new PrismaClient();
const app = createTestApp();

describe('Checkout Integration Tests', () => {
  let testUser;
  let testProductora;
  let testEvento;
  let testTipoEntrada;
  let testEntradas;
  let authCookies;

  beforeAll(async () => {
    // Limpiar datos de prueba
    await prisma.entrada.deleteMany({});
    await prisma.tipoEntrada.deleteMany({});
    await prisma.eventos.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.roleAsignee.deleteMany({});
    await prisma.profile.deleteMany({});
    await prisma.productora.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'checkout.test' } }
    });
  });

  afterAll(async () => {
    // Limpiar después de todos los tests
    await prisma.entrada.deleteMany({});
    await prisma.tipoEntrada.deleteMany({});
    await prisma.eventos.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.roleAsignee.deleteMany({});
    await prisma.profile.deleteMany({});
    await prisma.productora.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'checkout.test' } }
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Crear datos de prueba para cada test
    
    // 1. Crear usuario comprador
    const registerResponse = await request(app)
      .post('/auth/register')
      .send({
        name: 'Checkout Test User',
        email: 'checkout.test.buyer@example.com',
        password: 'password123',
        lastName: 'Test'
      })
      .expect(201);

    authCookies = registerResponse.headers['set-cookie'];
    testUser = registerResponse.body.user;

    // 2. Crear productora
    testProductora = await prisma.productora.create({
      data: {
        name: 'Test Productora Checkout',
        email: 'checkout.productora@test.com',
        code: 'TESTCHECKOUT'
      }
    });

    // 3. Crear evento
    testEvento = await prisma.eventos.create({
      data: {
        name: 'Evento Test Checkout',
        date: new Date('2025-12-31'),
        startTime: new Date('2025-12-31T20:00:00Z'),
        endTime: new Date('2025-12-31T23:00:00Z'),
        description: 'Evento de prueba para checkout',
        location: 'Test Location',
        capacity: 100,
        productoraId: testProductora.id,
        usuarios: {
          connect: { id: testUser.id }
        }
      }
    });

    // 4. Crear tipo de entrada
    testTipoEntrada = await prisma.tipoEntrada.create({
      data: {
        nombre: 'General Checkout Test',
        precio: 1500.0,
        eventoId: testEvento.id,
        totalEntradas: 50,
        maximoEntradasPorPersona: 4
      }
    });

    // 5. Crear entradas disponibles (5 entradas para testing)
    const entradasData = [];
    for (let i = 0; i < 5; i++) {
      entradasData.push({
        eventoId: testEvento.id,
        tipoEntradaId: testTipoEntrada.id,
        sellerId: testUser.id,
        qrCode: `TEST-QR-${i}-${Date.now()}`,
        estado: EstadoEntrada.DISPONIBLE
      });
    }

    await prisma.entrada.createMany({
      data: entradasData
    });

    testEntradas = await prisma.entrada.findMany({
      where: { tipoEntradaId: testTipoEntrada.id }
    });
  });

  afterEach(async () => {
    // Limpiar después de cada test
    await prisma.entrada.deleteMany({});
    await prisma.tipoEntrada.deleteMany({});
    await prisma.eventos.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.roleAsignee.deleteMany({});
    await prisma.profile.deleteMany({});
    await prisma.productora.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'checkout.test' } }
    });
  });

  describe('POST /checkout/iniciar', () => {
    it('debe iniciar checkout correctamente con usuario autenticado', async () => {
      const checkoutData = {
        tipoEntradaId: testTipoEntrada.id,
        cantidad: 2
      };

      const response = await request(app)
        .post('/checkout/iniciar')
        .set('Cookie', authCookies)
        .send(checkoutData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Checkout iniciado correctamente');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.paymentId).toBeDefined();
      expect(response.body.data.checkoutUrl).toContain('mercadopago');
      expect(response.body.data.reservaHasta).toBeDefined();
      expect(response.body.data.resumen).toMatchObject({
        evento: testEvento.name,
        tipoEntrada: testTipoEntrada.nombre,
        cantidad: 2,
        precioUnitario: testTipoEntrada.precio,
        total: testTipoEntrada.precio * 2
      });

      // Verificar que las entradas fueron reservadas
      const entradasReservadas = await prisma.entrada.findMany({
        where: {
          tipoEntradaId: testTipoEntrada.id,
          estado: EstadoEntrada.RESERVADA
        }
      });

      expect(entradasReservadas).toHaveLength(2);
      expect(entradasReservadas[0].buyerId).toBe(testUser.id);
      expect(entradasReservadas[0].reservadaHasta).toBeDefined();

      // Verificar que se creó el payment
      const payment = await prisma.payment.findUnique({
        where: { id: response.body.data.paymentId }
      });

      expect(payment).toBeDefined();
      expect(payment.userId).toBe(testUser.id);
      expect(payment.amount).toBe(testTipoEntrada.precio * 2);
      expect(payment.status).toBe('PENDING');
      expect(payment.mpPreferenceId).toBeDefined();
    });

    it('debe iniciar checkout sin autenticación con buyerInfo', async () => {
      const checkoutData = {
        tipoEntradaId: testTipoEntrada.id,
        cantidad: 1,
        buyerId: null,
        buyerInfo: {
          name: 'Comprador Anónimo',
          email: 'anonimo@test.com',
          phone: '+54911234567'
        }
      };

      const response = await request(app)
        .post('/checkout/iniciar')
        .send(checkoutData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.paymentId).toBeDefined();

      // Verificar payment sin userId
      const payment = await prisma.payment.findUnique({
        where: { id: response.body.data.paymentId }
      });

      expect(payment.userId).toBeNull();
      
      const metadata = JSON.parse(payment.metadata);
      expect(metadata.buyerInfo).toMatchObject({
        name: 'Comprador Anónimo',
        email: 'anonimo@test.com',
        phone: '+54911234567'
      });
    });

    it('debe fallar si no hay suficientes entradas disponibles', async () => {
      const checkoutData = {
        tipoEntradaId: testTipoEntrada.id,
        cantidad: 10 // Más de las 5 disponibles
      };

      const response = await request(app)
        .post('/checkout/iniciar')
        .set('Cookie', authCookies)
        .send(checkoutData)
        .expect(500);

      expect(response.body.error).toContain('Solo hay');
    });

    it('debe fallar con datos inválidos', async () => {
      const invalidData = {
        // tipoEntradaId faltante
        cantidad: 1
      };

      const response = await request(app)
        .post('/checkout/iniciar')
        .set('Cookie', authCookies)
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('tipoEntradaId y cantidad son requeridos');
    });
  });

  describe('Limpieza de reservas expiradas', () => {
    it('debe liberar entradas con reservas expiradas', async () => {
      // Crear entrada reservada manualmente con fecha expirada
      const entradaExpirada = await prisma.entrada.update({
        where: { id: testEntradas[0].id },
        data: {
          estado: EstadoEntrada.RESERVADA,
          buyerId: testUser.id,
          reservadaHasta: new Date(Date.now() - 1000) // Expirada hace 1 segundo
        }
      });

      // Ejecutar limpieza
      const response = await request(app)
        .post('/checkout/limpiar-reservas')
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('1 entradas liberadas');

      // Verificar que la entrada volvió a estar disponible
      const entradaLiberada = await prisma.entrada.findUnique({
        where: { id: entradaExpirada.id }
      });

      expect(entradaLiberada.estado).toBe(EstadoEntrada.DISPONIBLE);
      expect(entradaLiberada.buyerId).toBeNull();
      expect(entradaLiberada.reservadaHasta).toBeNull();
    });
  });

  describe('Flujo completo simulado', () => {
    it('debe completar flujo: checkout → pago aprobado → entradas confirmadas', async () => {
      // 1. Iniciar checkout
      const checkoutResponse = await request(app)
        .post('/checkout/iniciar')
        .set('Cookie', authCookies)
        .send({
          tipoEntradaId: testTipoEntrada.id,
          cantidad: 2
        })
        .expect(201);

      const paymentId = checkoutResponse.body.data.paymentId;

      // 2. Simular webhook de pago aprobado
      // (En un test real, esto vendría de MercadoPago)
      const mockMPPayment = {
        id: 'MP_PAYMENT_123',
        status: 'approved',
        preference_id: 'MP_PREF_123',
        payment_method_id: 'visa'
      };

      // Actualizar el payment con el preference_id para que el webhook lo encuentre
      await prisma.payment.update({
        where: { id: paymentId },
        data: { mpPreferenceId: 'MP_PREF_123' }
      });

      // Simular webhook
      const webhookResponse = await request(app)
        .post('/webhooks/mercadopago')
        .send({
          type: 'payment',
          data: { id: 'MP_PAYMENT_123' }
        });

      // 3. Verificar resultados
      const paymentFinal = await prisma.payment.findUnique({
        where: { id: paymentId }
      });

      const entradasVendidas = await prisma.entrada.findMany({
        where: {
          tipoEntradaId: testTipoEntrada.id,
          estado: EstadoEntrada.VENDIDA
        }
      });

      expect(paymentFinal.status).toBe('SUCCESS');
      expect(entradasVendidas).toHaveLength(2);
      expect(entradasVendidas[0].qrCode).toBeTruthy();
      expect(entradasVendidas[0].buyerId).toBe(testUser.id);
    });
  });
});