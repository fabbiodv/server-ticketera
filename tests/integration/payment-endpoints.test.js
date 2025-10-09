import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createTestApp } from '../helpers/testApp.js';
import request from 'supertest';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const app = createTestApp();

describe('💳 Payment Endpoints Tests', () => {
  let authToken;
  let testUser;
  let testPayment;
  let testEntrada;

  beforeAll(async () => {
    console.log('🧹 Limpiando base de datos para tests de Payment...');
    
    await prisma.entrada.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.tipoEntrada.deleteMany({});
    await prisma.eventos.deleteMany({});
    await prisma.roleAsignee.deleteMany({});
    await prisma.profile.deleteMany({});
    await prisma.productora.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'paytest' } }
    });
  });

  afterAll(async () => {
    await prisma.entrada.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.tipoEntrada.deleteMany({});
    await prisma.eventos.deleteMany({});
    await prisma.roleAsignee.deleteMany({});
    await prisma.profile.deleteMany({});
    await prisma.productora.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'paytest' } }
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    console.log('📋 Preparando datos para test de Payment...');

    // Crear usuario
    const hashedPassword = await bcrypt.hash('123456', 10);
    testUser = await prisma.user.create({
      data: {
        name: 'Test Payment User',
        email: 'payment.paytest@ticketera.com',
        password: hashedPassword,
        lastName: 'Test',
        status: 'ACTIVE'
      }
    });

    // Crear productora
    const testProductora = await prisma.productora.create({
      data: {
        name: 'Test Productora Payment',
        email: 'payment.paytest@productora.com',
        code: 'TESTPAY001'
      }
    });

    // Crear evento
    const testEvento = await prisma.eventos.create({
      data: {
        name: 'Test Evento Payment',
        date: new Date('2025-12-31T20:00:00Z'),
        startTime: new Date('2025-12-31T20:00:00Z'),
        endTime: new Date('2025-12-31T23:59:00Z'),
        description: 'Evento de prueba para Payment',
        location: 'Test Location Payment',
        capacity: 1000,
        productoraId: testProductora.id
      }
    });

    // Crear tipo de entrada
    const testTipoEntrada = await prisma.tipoEntrada.create({
      data: {
        nombre: 'General Payment Test',
        precio: 25000,
        eventoId: testEvento.id,
        totalEntradas: 50,
        maximoEntradasPorPersona: 3
      }
    });

    // Crear entrada
    testEntrada = await prisma.entrada.create({
      data: {
        qrCode: 'TEST-PAYMENT-QR-001',
        escaneado: false,
        estado: 'VENDIDA',
        eventoId: testEvento.id,
        tipoEntradaId: testTipoEntrada.id,
        buyerId: testUser.id
      }
    });

    // Crear payment de prueba
    testPayment = await prisma.payment.create({
      data: {
        userId: testUser.id,
        entradaId: testEntrada.id,
        amount: 25000,
        status: 'SUCCESS',
        paymentMethod: 'MERCADOPAGO',
        mpPreferenceId: 'test-preference-payment-123',
        mpPaymentId: 'test-mp-payment-789',
        mpInitPoint: 'https://mercadopago.com/checkout/test-payment'
      }
    });

    // Autenticar usuario
    const loginResponse = await request(app)
      .post('/auth/login-password')
      .send({
        email: 'payment.paytest@ticketera.com',
        password: '123456'
      });

    authToken = loginResponse.body.accessToken;
    console.log('✅ Datos de Payment preparados correctamente');
  });

  describe('GET /payment - Obtener todos los pagos', () => {
    it('debe obtener todos los pagos correctamente', async () => {
      console.log('🔍 Testing GET /payment...');

      const response = await request(app)
        .get('/payment')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      
      const payment = response.body.find(p => p.id === testPayment.id);
      expect(payment).toBeDefined();
      expect(payment.amount).toBe(25000);
      expect(payment.status).toBe('SUCCESS');
      expect(payment.mpPreferenceId).toBe('test-preference-payment-123');
      expect(payment.mpPaymentId).toBe('test-mp-payment-789');

      console.log('✅ GET /payment funcionando correctamente');
      console.log(`📊 Pagos encontrados: ${response.body.length}`);
    });

    it('debe filtrar pagos por userId', async () => {
      const response = await request(app)
        .get(`/payment?userId=${testUser.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.every(p => p.userId === testUser.id)).toBe(true);

      console.log('✅ Filtro por userId funcionando');
    });

    it('debe filtrar pagos por status', async () => {
      const response = await request(app)
        .get('/payment?status=SUCCESS')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.every(p => p.status === 'SUCCESS')).toBe(true);

      console.log('✅ Filtro por status funcionando');
    });

    it('debe filtrar pagos por rango de montos', async () => {
      const response = await request(app)
        .get('/payment?minAmount=20000&maxAmount=30000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.every(p => p.amount >= 20000 && p.amount <= 30000)).toBe(true);

      console.log('✅ Filtro por rango de montos funcionando');
    });

    it('debe soportar paginación', async () => {
      const response = await request(app)
        .get('/payment?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeLessThanOrEqual(1);

      console.log('✅ Paginación funcionando');
    });
  });

  describe('GET /payment/ventas/vendedor/:vendedorId - Ventas por vendedor', () => {
    it('debe obtener ventas por vendedor', async () => {
      console.log('🔍 Testing GET /payment/ventas/vendedor/:vendedorId...');

      // Crear vendedor con entradas vendidas
      const vendedor = await prisma.user.create({
        data: {
          name: 'Test Vendedor Sales',
          email: 'vendedor.sales.paytest@ticketera.com',
          password: await bcrypt.hash('123456', 10),
          lastName: 'Vendedor',
          status: 'ACTIVE'
        }
      });

      // Crear entrada vendida por el vendedor
      const entradaVendedor = await prisma.entrada.create({
        data: {
          qrCode: 'TEST-VENDEDOR-QR-001',
          escaneado: false,
          estado: 'VENDIDA',
          eventoId: testEntrada.eventoId,
          tipoEntradaId: testEntrada.tipoEntradaId,
          sellerId: vendedor.id,
          buyerId: testUser.id
        }
      });

      // Crear payment para la venta del vendedor
      await prisma.payment.create({
        data: {
          userId: testUser.id,
          entradaId: entradaVendedor.id,
          amount: 25000,
          status: 'SUCCESS',
          paymentMethod: 'MERCADOPAGO'
        }
      });

      const response = await request(app)
        .get(`/payment/ventas/vendedor/${vendedor.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('vendedor');
      expect(response.body).toHaveProperty('ventas');
      expect(response.body).toHaveProperty('totalVentas');
      expect(response.body).toHaveProperty('totalComision');
      
      expect(response.body.vendedor.id).toBe(vendedor.id);
      expect(response.body.ventas).toBeInstanceOf(Array);
      expect(response.body.ventas.length).toBeGreaterThan(0);
      expect(response.body.totalVentas).toBeGreaterThan(0);

      console.log('✅ GET /payment/ventas/vendedor/:vendedorId funcionando');
      console.log(`📊 Ventas del vendedor: ${response.body.ventas.length}`);
      console.log(`💰 Total de ventas: $${response.body.totalVentas}`);
    });

    it('debe manejar vendedor inexistente', async () => {
      const response = await request(app)
        .get('/payment/ventas/vendedor/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Vendedor no encontrado');

      console.log('✅ Error de vendedor inexistente manejado correctamente');
    });
  });

  describe('🔒 Autenticación en endpoints de Payment', () => {
    it('debe requerir autenticación para GET /payment', async () => {
      const response = await request(app)
        .get('/payment');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('token');

      console.log('✅ Autenticación requerida para GET /payment');
    });

    it('debe requerir autenticación para ventas de vendedor', async () => {
      const response = await request(app)
        .get('/payment/ventas/vendedor/1');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('token');

      console.log('✅ Autenticación requerida para ventas de vendedor');
    });

    it('debe rechazar tokens inválidos', async () => {
      const response = await request(app)
        .get('/payment')
        .set('Authorization', 'Bearer token-invalido');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('token');

      console.log('✅ Tokens inválidos rechazados correctamente');
    });
  });

  describe('📊 Tests de Performance y Datos', () => {
    it('debe manejar múltiples pagos correctamente', async () => {
      console.log('🚀 Testing performance con múltiples pagos...');

      // Crear múltiples pagos
      const payments = [];
      for (let i = 0; i < 20; i++) {
        payments.push({
          userId: testUser.id,
          amount: 10000 + (i * 1000),
          status: i % 3 === 0 ? 'SUCCESS' : i % 3 === 1 ? 'PENDING' : 'FAILURE',
          paymentMethod: 'MERCADOPAGO',
          mpPreferenceId: `test-perf-pref-${i}`,
          createdAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)) // i días atrás
        });
      }

      await prisma.payment.createMany({ data: payments });

      const response = await request(app)
        .get('/payment?limit=10&sortBy=createdAt&sortOrder=desc')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeLessThanOrEqual(10);

      // Verificar orden descendente
      const dates = response.body.map(p => new Date(p.createdAt));
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i-1].getTime()).toBeGreaterThanOrEqual(dates[i].getTime());
      }

      console.log('✅ Performance test completado');
      console.log(`📈 Procesados ${response.body.length} pagos ordenados correctamente`);
    });

    it('debe calcular estadísticas de ventas correctamente', async () => {
      const vendedor = await prisma.user.create({
        data: {
          name: 'Test Stats Vendedor',
          email: 'stats.vendedor.paytest@ticketera.com',
          password: await bcrypt.hash('123456', 10),
          lastName: 'Stats',
          status: 'ACTIVE'
        }
      });

      // Crear múltiples ventas para calcular estadísticas
      const ventas = [
        { amount: 15000, status: 'SUCCESS' },
        { amount: 20000, status: 'SUCCESS' },
        { amount: 30000, status: 'SUCCESS' },
        { amount: 25000, status: 'PENDING' }, // No debe contar
        { amount: 10000, status: 'FAILURE' }  // No debe contar
      ];

      for (const venta of ventas) {
        const entrada = await prisma.entrada.create({
          data: {
            qrCode: `STATS-QR-${Math.random().toString(36).substr(2, 9)}`,
            escaneado: false,
            estado: venta.status === 'SUCCESS' ? 'VENDIDA' : 'DISPONIBLE',
            eventoId: testEntrada.eventoId,
            tipoEntradaId: testEntrada.tipoEntradaId,
            sellerId: vendedor.id
          }
        });

        await prisma.payment.create({
          data: {
            userId: testUser.id,
            entradaId: entrada.id,
            amount: venta.amount,
            status: venta.status,
            paymentMethod: 'MERCADOPAGO'
          }
        });
      }

      const response = await request(app)
        .get(`/payment/ventas/vendedor/${vendedor.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalVentas).toBe(65000); // Solo SUCCESS: 15000 + 20000 + 30000
      expect(response.body.ventas.length).toBe(3); // Solo las SUCCESS
      expect(response.body.totalComision).toBeGreaterThan(0); // Debe tener comisión

      console.log('✅ Estadísticas calculadas correctamente');
      console.log(`💰 Total ventas exitosas: $${response.body.totalVentas}`);
      console.log(`💸 Comisión total: $${response.body.totalComision}`);
    });
  });
});