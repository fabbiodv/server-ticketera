import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createTestApp } from '../helpers/testApp.js';
import request from 'supertest';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const app = createTestApp();

// Mock MercadoPago
vi.mock('mercadopago', () => ({
  MercadoPagoConfig: vi.fn().mockImplementation(() => ({})),
  Preference: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue({
      body: {
        id: 'test-preference-123',
        init_point: 'https://mercadopago.com/checkout/test-preference-123'
      }
    })
  })),
  Payment: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue({
      id: 'test-mp-payment-456',
      status: 'approved',
      preference_id: 'test-preference-123',
      external_reference: '1,2'
    })
  }))
}));

describe('🛒 MercadoPago Checkout Integration Tests', () => {
  let authToken;
  let testUser;
  let testProductora;
  let testEvento;
  let testTipoEntrada;
  let testVendedor;
  let testProfile;

  beforeAll(async () => {
    console.log('🧹 Limpiando base de datos para tests MercadoPago...');
    
    // Limpiar en orden correcto
    await prisma.entrada.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.tipoEntrada.deleteMany({});
    await prisma.eventos.deleteMany({});
    await prisma.roleAsignee.deleteMany({});
    await prisma.profile.deleteMany({});
    await prisma.productora.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'mptest' } }
    });
  });

  afterAll(async () => {
    console.log('🧹 Limpieza final de tests MercadoPago...');
    
    await prisma.entrada.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.tipoEntrada.deleteMany({});
    await prisma.eventos.deleteMany({});
    await prisma.roleAsignee.deleteMany({});
    await prisma.profile.deleteMany({});
    await prisma.productora.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'mptest' } }
    });
    
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    console.log('📋 Preparando datos de test...');
    
    // Limpiar datos específicos del test
    await prisma.entrada.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.tipoEntrada.deleteMany({});
    await prisma.eventos.deleteMany({});
    await prisma.roleAsignee.deleteMany({});
    await prisma.profile.deleteMany({});
    await prisma.productora.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'mptest' } }
    });
    
    // 1. Crear usuario admin
    const hashedPassword = await bcrypt.hash('123456', 10);
    testUser = await prisma.user.create({
      data: {
        name: 'Test Admin MP',
        email: 'admin.mptest@ticketera.com',
        password: hashedPassword,
        lastName: 'Test',
        status: 'ACTIVE'
      }
    });

    // 2. Crear productora
    testProductora = await prisma.productora.create({
      data: {
        name: 'Test Productora MP',
        email: 'test.mptest@productora.com',
        code: 'TESTMP001'
      }
    });

    // 3. Crear evento
    testEvento = await prisma.eventos.create({
      data: {
        name: 'Test Evento MercadoPago',
        date: new Date('2025-12-31T20:00:00Z'),
        startTime: new Date('2025-12-31T20:00:00Z'),
        endTime: new Date('2025-12-31T23:59:00Z'),
        description: 'Evento de prueba para MercadoPago',
        location: 'Test Location',
        capacity: 1000,
        productoraId: testProductora.id
      }
    });

    // 4. Crear tipo de entrada
    testTipoEntrada = await prisma.tipoEntrada.create({
      data: {
        nombre: 'VIP Test MP',
        precio: 50000,
        eventoId: testEvento.id,
        totalEntradas: 100,
        maximoEntradasPorPersona: 5
      }
    });

    // 5. Crear entradas disponibles
    const entradas = [];
    for (let i = 0; i < 10; i++) {
      entradas.push({
        qrCode: `TEST-QR-MP-${i.toString().padStart(3, '0')}`,
        escaneado: false,
        estado: 'DISPONIBLE',
        eventoId: testEvento.id,
        tipoEntradaId: testTipoEntrada.id
      });
    }
    await prisma.entrada.createMany({ data: entradas });

    // 6. Crear vendedor
    testVendedor = await prisma.user.create({
      data: {
        name: 'Test Vendedor MP',
        email: 'vendedor.mptest@ticketera.com',
        password: hashedPassword,
        lastName: 'Vendedor',
        status: 'ACTIVE'
      }
    });

    // 7. Crear perfil vendedor
    testProfile = await prisma.profile.create({
      data: {
        userId: testVendedor.id,
        productoraId: testProductora.id,
        qrCode: 'VND-TESTMP123456'
      }
    });

    // 8. Asignar rol OWNER al perfil para que pueda vender
    await prisma.roleAsignee.create({
      data: {
        profileId: testProfile.id,
        role: 'OWNER'
      }
    });

    // 9. Crear perfil OWNER para el usuario admin también
    const adminProfile = await prisma.profile.create({
      data: {
        userId: testUser.id,
        productoraId: testProductora.id,
        qrCode: 'ADM-TESTMP789'
      }
    });

    await prisma.roleAsignee.create({
      data: {
        profileId: adminProfile.id,
        role: 'OWNER'
      }
    });

    // 10. Autenticar usuario
    const loginResponse = await request(app)
      .post('/auth/login-password')
      .send({
        email: 'admin.mptest@ticketera.com',
        password: '123456'
      });

    authToken = loginResponse.body.accessToken;
    console.log('✅ Datos de test preparados correctamente');
  });

  describe('🎯 Flujo Completo: Compra Normal con MercadoPago', () => {
    it('debe completar el flujo de compra normal con MercadoPago', async () => {
      console.log('🚀 Iniciando test de compra normal...');

      // Step 1: Ver eventos disponibles
      const eventosResponse = await request(app)
        .get('/eventos')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(eventosResponse.status).toBe(200);
      expect(eventosResponse.body).toBeInstanceOf(Array);
      expect(eventosResponse.body.length).toBeGreaterThan(0);
      console.log('✅ Eventos obtenidos correctamente');

      // Step 2: Ver tipos de entrada
      const tiposResponse = await request(app)
        .get(`/tipoEntrada?eventoId=${testEvento.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(tiposResponse.status).toBe(200);
      expect(tiposResponse.body).toBeInstanceOf(Array);
      expect(tiposResponse.body.length).toBeGreaterThan(0);
      console.log('✅ Tipos de entrada obtenidos correctamente');

      // Step 3: Iniciar checkout con MercadoPago
      const checkoutResponse = await request(app)
        .post('/checkout/iniciar')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tipoEntradaId: testTipoEntrada.id,
          cantidad: 2,
          buyerInfo: {
            name: 'Juan Pérez Test',
            email: 'juan.test.mp@example.com',
            phone: '+54911234567'
          }
        });

      expect(checkoutResponse.status).toBe(201);
      expect(checkoutResponse.body.success).toBe(true);
      expect(checkoutResponse.body).toHaveProperty('paymentId');
      expect(checkoutResponse.body).toHaveProperty('mpPreferenceId');
      expect(checkoutResponse.body).toHaveProperty('mpInitPoint');
      expect(checkoutResponse.body.mpInitPoint).toContain('mercadopago.com');
      expect(checkoutResponse.body.entradas).toHaveLength(2);
      
      const paymentId = checkoutResponse.body.paymentId;
      const mpPreferenceId = checkoutResponse.body.mpPreferenceId;
      
      console.log('✅ Checkout iniciado con MercadoPago:', {
        paymentId,
        mpPreferenceId,
        mpInitPoint: checkoutResponse.body.mpInitPoint
      });

      // Step 4: Verificar payment creado
      const paymentsResponse = await request(app)
        .get('/payment')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(paymentsResponse.status).toBe(200);
      const payment = paymentsResponse.body.find(p => p.id === paymentId);
      expect(payment).toBeDefined();
      expect(payment.status).toBe('PENDING');
      expect(payment.mpPreferenceId).toBe(mpPreferenceId);
      expect(payment.mpInitPoint).toContain('mercadopago.com');
      console.log('✅ Payment creado correctamente con estado PENDING');

      // Step 5: Verificar entradas reservadas
      const entradasReservadas = await request(app)
        .get('/entradas?estado=RESERVADA')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(entradasReservadas.status).toBe(200);
      expect(entradasReservadas.body).toHaveLength(2);
      expect(entradasReservadas.body.every(e => e.estado === 'RESERVADA')).toBe(true);
      console.log('✅ Entradas reservadas correctamente:', entradasReservadas.body.length);

      // Step 6: Simular webhook de MercadoPago (pago exitoso)
      const webhookResponse = await request(app)
        .post('/webhooks/mercadopago')
        .send({
          type: 'payment',
          data: {
            id: 'test-mp-payment-456'
          }
        });

      expect(webhookResponse.status).toBe(200);
      console.log('✅ Webhook de MercadoPago procesado');

      // Step 7: Verificar payment actualizado a SUCCESS
      const updatedPaymentsResponse = await request(app)
        .get('/payment')
        .set('Authorization', `Bearer ${authToken}`);
      
      const updatedPayment = updatedPaymentsResponse.body.find(p => p.id === paymentId);
      expect(updatedPayment.status).toBe('SUCCESS');
      expect(updatedPayment.mpPaymentId).toBe('test-mp-payment-456');
      console.log('✅ Payment actualizado a SUCCESS con mpPaymentId');

      // Step 8: Verificar entradas vendidas
      const entradasVendidas = await request(app)
        .get('/entradas?estado=VENDIDA')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(entradasVendidas.status).toBe(200);
      expect(entradasVendidas.body).toHaveLength(2);
      expect(entradasVendidas.body.every(e => e.estado === 'VENDIDA')).toBe(true);
      console.log('✅ Entradas actualizadas a VENDIDA');

      console.log('🎉 Flujo completo de compra normal con MercadoPago completado exitosamente!');
    });
  });

  describe('🧑‍💼 Flujo Completo: Compra por Vendedor con MercadoPago', () => {
    it('debe completar el flujo de compra por vendedor con MercadoPago', async () => {
      console.log('🚀 Iniciando test de compra por vendedor...');

      // Step 1: Ver vendedores de productora
      const vendedoresResponse = await request(app)
        .get(`/vendedores/productora/${testProductora.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(vendedoresResponse.status).toBe(200);
      expect(vendedoresResponse.body).toBeInstanceOf(Array);
      expect(vendedoresResponse.body.length).toBeGreaterThan(0);
      console.log('✅ Vendedores obtenidos:', vendedoresResponse.body.length);

      // Step 2: Ver eventos disponibles por vendedor
      const eventosVendedorResponse = await request(app)
        .get('/vendedores/qr/VND-TESTMP123456/eventos')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(eventosVendedorResponse.status).toBe(200);
      expect(eventosVendedorResponse.body.eventos).toBeInstanceOf(Array);
      console.log('✅ Eventos por vendedor obtenidos');

      // Step 3: Generar link de pago por vendedor
      const vendedorPaymentResponse = await request(app)
        .post('/payment/generar-link-vendedor')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tipoEntradaId: testTipoEntrada.id,
          vendedorQR: 'VND-TESTMP123456',
          cantidad: 1,
          buyerInfo: {
            name: 'María García Test',
            email: 'maria.test.mp@example.com',
            phone: '+54911234567'
          }
        });

      expect(vendedorPaymentResponse.status).toBe(200);
      expect(vendedorPaymentResponse.body.success).toBe(true);
      expect(vendedorPaymentResponse.body).toHaveProperty('paymentId');
      expect(vendedorPaymentResponse.body).toHaveProperty('mpPreferenceId');
      expect(vendedorPaymentResponse.body).toHaveProperty('mpInitPoint');
      expect(vendedorPaymentResponse.body.entradas).toHaveLength(1);
      expect(vendedorPaymentResponse.body.entradas[0].sellerId).toBe(testVendedor.id);
      
      console.log('✅ Link de pago por vendedor generado:', {
        paymentId: vendedorPaymentResponse.body.paymentId,
        vendedor: vendedorPaymentResponse.body.vendedor?.name
      });

      // Step 4: Verificar ventas del vendedor
      const ventasVendedorResponse = await request(app)
        .get(`/payment/ventas/vendedor/${testVendedor.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(ventasVendedorResponse.status).toBe(200);
      expect(ventasVendedorResponse.body.ventas).toBeInstanceOf(Array);
      console.log('✅ Ventas del vendedor verificadas');

      // Step 5: Verificar entrada con sellerId
      const entradasVendedor = await request(app)
        .get(`/entradas?sellerId=${testVendedor.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(entradasVendedor.status).toBe(200);
      expect(entradasVendedor.body).toHaveLength(1);
      expect(entradasVendedor.body[0].sellerId).toBe(testVendedor.id);
      expect(entradasVendedor.body[0].estado).toBe('RESERVADA');
      console.log('✅ Entrada asignada al vendedor correctamente');

      console.log('🎉 Flujo completo de compra por vendedor con MercadoPago completado exitosamente!');
    });
  });

  describe('⏰ Test de Limpieza de Reservas Expiradas', () => {
    it('debe limpiar reservas expiradas correctamente', async () => {
      console.log('🚀 Iniciando test de limpieza de reservas...');

      // Step 1: Crear reservas que expiren inmediatamente
      const reservaResponse = await request(app)
        .post('/checkout/iniciar')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tipoEntradaId: testTipoEntrada.id,
          cantidad: 1,
          buyerInfo: {
            name: 'Test Expiry',
            email: 'expiry.test@example.com',
            phone: '+54911111111'
          }
        });

      expect(reservaResponse.status).toBe(201);
      console.log('✅ Reserva creada para test de expiración');

      // Step 2: Modificar manualmente la reserva para que expire
      const entradaReservada = await prisma.entrada.findFirst({
        where: { estado: 'RESERVADA' }
      });
      
      await prisma.entrada.update({
        where: { id: entradaReservada.id },
        data: {
          reservadaHasta: new Date(Date.now() - 1000) // Expirada hace 1 segundo
        }
      });
      console.log('✅ Reserva marcada como expirada manualmente');

      // Step 3: Ejecutar limpieza de reservas
      const limpiezaResponse = await request(app)
        .post('/checkout/limpiar-reservas')
        .set('Authorization', `Bearer ${authToken}`);

      expect(limpiezaResponse.status).toBe(200);
      expect(limpiezaResponse.body.success).toBe(true);
      expect(parseInt(limpiezaResponse.body.message)).toBeGreaterThan(0);
      console.log('✅ Limpieza ejecutada:', limpiezaResponse.body.message);

      // Step 4: Verificar que las entradas están disponibles nuevamente
      const entradasDisponibles = await request(app)
        .get('/entradas?estado=DISPONIBLE')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(entradasDisponibles.status).toBe(200);
      expect(entradasDisponibles.body.length).toBeGreaterThan(0);
      console.log('✅ Entradas liberadas correctamente');

      console.log('🎉 Test de limpieza de reservas completado exitosamente!');
    });
  });

  describe('❌ Test de Manejo de Errores', () => {
    it('debe manejar errores de MercadoPago correctamente', async () => {
      console.log('🚀 Iniciando test de manejo de errores...');

      // Test 1: Checkout sin datos requeridos
      const checkoutError = await request(app)
        .post('/checkout/iniciar')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
      
      expect(checkoutError.status).toBe(400);
      expect(checkoutError.body.error).toContain('requeridos');
      console.log('✅ Error de validación manejado correctamente');

      // Test 2: Tipo de entrada inexistente
      const tipoInexistente = await request(app)
        .post('/checkout/iniciar')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tipoEntradaId: 99999,
          cantidad: 1,
          buyerInfo: { name: 'Test', email: 'test@test.com' }
        });
      
      expect(tipoInexistente.status).toBe(404);
      expect(tipoInexistente.body.error).toContain('no encontrado');
      console.log('✅ Error de tipo de entrada inexistente manejado');

      // Test 3: Vendedor QR inexistente
      const vendedorInexistente = await request(app)
        .post('/payment/generar-link-vendedor')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tipoEntradaId: testTipoEntrada.id,
          vendedorQR: 'VND-INEXISTENTE',
          cantidad: 1,
          buyerInfo: { name: 'Test', email: 'test@test.com' }
        });
      
      expect(vendedorInexistente.status).toBe(404);
      console.log('✅ Error de vendedor inexistente manejado');

      console.log('🎉 Test de manejo de errores completado exitosamente!');
    });
  });
});