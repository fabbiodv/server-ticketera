import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createTestApp } from '../helpers/testApp.js';
import request from 'supertest';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const app = createTestApp();

// Mock básico de MercadoPago
vi.mock('mercadopago', () => ({
  MercadoPagoConfig: vi.fn().mockImplementation(() => ({})),
  Preference: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue({
      body: {
        id: 'test-preference-simple',
        init_point: 'https://mercadopago.com/checkout/test-simple'
      }
    })
  })),
  Payment: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue({
      id: 'test-payment-simple',
      status: 'approved',
      preference_id: 'test-preference-simple'
    })
  }))
}));

describe('🧪 Tests Básicos del Sistema de Pagos', () => {
  let authToken;
  let testData = {};

  beforeAll(async () => {
    console.log('🧹 Preparando entorno de test básico...');
    
    // Limpiar completamente
    await prisma.entrada.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.tipoEntrada.deleteMany({});
    await prisma.eventos.deleteMany({});
    await prisma.roleAsignee.deleteMany({});
    await prisma.profile.deleteMany({});
    await prisma.productora.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'basictest' } }
    });

    // Crear datos base una sola vez
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    testData.user = await prisma.user.create({
      data: {
        name: 'Basic Test User',
        email: 'basic.basictest@ticketera.com',
        password: hashedPassword,
        lastName: 'Test',
        status: 'ACTIVE'
      }
    });

    testData.productora = await prisma.productora.create({
      data: {
        name: 'Basic Test Productora',
        email: 'basic.basictest@productora.com',
        code: 'BASIC001'
      }
    });

    testData.evento = await prisma.eventos.create({
      data: {
        name: 'Basic Test Evento',
        date: new Date('2025-12-31T20:00:00Z'),
        startTime: new Date('2025-12-31T20:00:00Z'),
        endTime: new Date('2025-12-31T23:59:00Z'),
        description: 'Evento básico de prueba',
        location: 'Test Location',
        capacity: 100,
        productoraId: testData.productora.id
      }
    });

    testData.tipoEntrada = await prisma.tipoEntrada.create({
      data: {
        nombre: 'General Basic',
        precio: 10000,
        eventoId: testData.evento.id,
        totalEntradas: 50,
        maximoEntradasPorPersona: 5
      }
    });

    // Crear entradas disponibles
    const entradas = [];
    for (let i = 0; i < 5; i++) {
      entradas.push({
        qrCode: `BASIC-QR-${i.toString().padStart(3, '0')}`,
        escaneado: false,
        estado: 'DISPONIBLE',
        eventoId: testData.evento.id,
        tipoEntradaId: testData.tipoEntrada.id
      });
    }
    await prisma.entrada.createMany({ data: entradas });

    // Crear perfil OWNER
    const profile = await prisma.profile.create({
      data: {
        userId: testData.user.id,
        productoraId: testData.productora.id,
        qrCode: 'BASIC-PROFILE-QR'
      }
    });

    await prisma.roleAsignee.create({
      data: {
        profileId: profile.id,
        role: 'OWNER'
      }
    });

    // Autenticar
    const loginResponse = await request(app)
      .post('/auth/login-password')
      .send({
        email: 'basic.basictest@ticketera.com',
        password: '123456'
      });

    authToken = loginResponse.body.tokens.accessToken;
    console.log('🔐 Token obtenido:', authToken?.substring(0, 50) + '...');
    console.log('✅ Entorno de test básico preparado');
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
      where: { email: { contains: 'basictest' } }
    });
    await prisma.$disconnect();
  });

  describe('🔍 Endpoints Básicos', () => {
    it('GET /eventos - debe obtener eventos', async () => {
      const response = await request(app)
        .get('/eventos')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      console.log('✅ GET /eventos funcionando');
    });

    it('GET /tipoEntrada - debe obtener tipos de entrada', async () => {
      const response = await request(app)
        .get(`/tipoEntrada?eventoId=${testData.evento.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      console.log('✅ GET /tipoEntrada funcionando');
    });

    it('GET /entradas - debe obtener entradas', async () => {
      const response = await request(app)
        .get('/entradas')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      console.log('✅ GET /entradas funcionando');
    });

    it('GET /payment - debe obtener pagos', async () => {
      const response = await request(app)
        .get('/payment')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      console.log('✅ GET /payment funcionando');
    });
  });

  describe('🛒 Test de Checkout Básico', () => {
    it('POST /checkout/iniciar - debe iniciar checkout básico', async () => {
      const response = await request(app)
        .post('/checkout/iniciar')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tipoEntradaId: testData.tipoEntrada.id,
          cantidad: 1,
          buyerInfo: {
            name: 'Test Buyer',
            email: 'buyer@test.com',
            phone: '+54911111111'
          }
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('paymentId');
      expect(response.body).toHaveProperty('mpPreferenceId');
      expect(response.body).toHaveProperty('mpInitPoint');
      expect(response.body.mpInitPoint).toContain('mercadopago.com');
      
      console.log('✅ Checkout básico funcionando');
      console.log(`📋 PaymentId: ${response.body.paymentId}`);
      console.log(`🔗 MercadoPago Link: ${response.body.mpInitPoint}`);
    });

    it('POST /checkout/limpiar-reservas - debe limpiar reservas', async () => {
      const response = await request(app)
        .post('/checkout/limpiar-reservas')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
      
      console.log('✅ Limpieza de reservas funcionando');
      console.log(`📊 ${response.body.message}`);
    });
  });

  describe('🧑‍💼 Test de Vendedores Básico', () => {
    it('GET /vendedores/productora/:id - debe obtener vendedores', async () => {
      const response = await request(app)
        .get(`/vendedores/productora/${testData.productora.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      console.log('✅ GET vendedores funcionando');
    });

    it('GET /vendedores/qr/:qr/eventos - debe obtener eventos por QR', async () => {
      const response = await request(app)
        .get('/vendedores/qr/BASIC-PROFILE-QR/eventos');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('eventos');
      console.log('✅ GET eventos por QR funcionando');
    });
  });

  describe('📊 Test de Estadísticas', () => {
    it('debe mostrar estadísticas del sistema', async () => {
      // Obtener conteos básicos
      const [eventos, entradas, payments, users] = await Promise.all([
        request(app).get('/eventos').set('Authorization', `Bearer ${authToken}`),
        request(app).get('/entradas').set('Authorization', `Bearer ${authToken}`),
        request(app).get('/payment').set('Authorization', `Bearer ${authToken}`),
        request(app).get('/users').set('Authorization', `Bearer ${authToken}`)
      ]);

      console.log('📊 Estadísticas del Sistema:');
      console.log(`   👥 Usuarios: ${users.body.length}`);
      console.log(`   🎪 Eventos: ${eventos.body.length}`);
      console.log(`   🎫 Entradas: ${entradas.body.length}`);
      console.log(`   💳 Pagos: ${payments.body.length}`);

      expect(eventos.status).toBe(200);
      expect(entradas.status).toBe(200);
      expect(payments.status).toBe(200);
      expect(users.status).toBe(200);
    });
  });

  describe('🔒 Test de Autenticación', () => {
    it('debe rechazar requests sin token', async () => {
      const response = await request(app).get('/payment');
      expect(response.status).toBe(401);
      console.log('✅ Autenticación requerida correctamente');
    });

    it('debe rechazar tokens inválidos', async () => {
      const response = await request(app)
        .get('/payment')
        .set('Authorization', 'Bearer token-invalido');
      expect(response.status).toBe(401);
      console.log('✅ Tokens inválidos rechazados correctamente');
    });
  });
});