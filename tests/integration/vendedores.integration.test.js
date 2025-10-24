import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { createTestApp } from '../helpers/testApp.js';
import prisma from '../../src/config/database.js';
import { createTestToken } from '../helpers/testHelpers.js';

describe('🧑‍💼 Vendedores Controller - Integration Tests', () => {
  let app;
  let testUsers = {};
  let testProductoras = {};
  let testProfiles = {};
  let authTokens = {};

  beforeAll(async () => {
    // Configurar variables de entorno necesarias para JWT
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    
    app = createTestApp();
    
    // Limpiar datos existentes
    await prisma.roleAsignee.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.eventos.deleteMany();
    await prisma.productora.deleteMany();
    await prisma.user.deleteMany();

    // Crear usuarios de prueba
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Usuario SUPERADMIN
    testUsers.superadmin = await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: 'superadmin@test.com',
        password: hashedPassword,
        status: 'ACTIVE'
      }
    });

    // Usuario OWNER de productora 1
    testUsers.owner1 = await prisma.user.create({
      data: {
        name: 'Owner Uno',
        email: 'owner1@test.com',
        password: hashedPassword,
        status: 'ACTIVE'
      }
    });

    // Usuario LIDER de productora 2
    testUsers.lider = await prisma.user.create({
      data: {
        name: 'Líder Test',
        email: 'lider@test.com',
        password: hashedPassword,
        status: 'ACTIVE'
      }
    });

    // Usuario PUBLICA (vendedor)
    testUsers.vendedor = await prisma.user.create({
      data: {
        name: 'Vendedor Test',
        email: 'vendedor@test.com',
        password: hashedPassword,
        status: 'ACTIVE'
      }
    });

    // Usuario sin roles
    testUsers.sinRoles = await prisma.user.create({
      data: {
        name: 'Sin Roles',
        email: 'sinroles@test.com',
        password: hashedPassword,
        status: 'ACTIVE'
      }
    });

    // Crear productoras
    testProductoras.prod1 = await prisma.productora.create({
      data: {
        name: 'Productora Uno',
        email: 'prod1@test.com',
        code: 'PROD001',
        status: 'activa'
      }
    });

    testProductoras.prod2 = await prisma.productora.create({
      data: {
        name: 'Productora Dos', 
        email: 'prod2@test.com',
        code: 'PROD002',
        status: 'activa'
      }
    });

    // Crear perfiles y roles
    // Profile OWNER productora 1
    testProfiles.ownerProd1 = await prisma.profile.create({
      data: {
        userId: testUsers.owner1.id,
        productoraId: testProductoras.prod1.id,
        qrCode: 'OWNER-QR-001'
      }
    });
    
    await prisma.roleAsignee.create({
      data: {
        profileId: testProfiles.ownerProd1.id,
        role: 'OWNER'
      }
    });

    // Profile LIDER productora 2
    testProfiles.liderProd2 = await prisma.profile.create({
      data: {
        userId: testUsers.lider.id,
        productoraId: testProductoras.prod2.id,
        qrCode: 'LIDER-QR-002'
      }
    });
    
    await prisma.roleAsignee.create({
      data: {
        profileId: testProfiles.liderProd2.id,
        role: 'LIDER'
      }
    });

    // Profile VENDEDOR productora 1
    testProfiles.vendedorProd1 = await prisma.profile.create({
      data: {
        userId: testUsers.vendedor.id,
        productoraId: testProductoras.prod1.id,
        qrCode: 'VENDEDOR-QR-003'
      }
    });
    
    await prisma.roleAsignee.create({
      data: {
        profileId: testProfiles.vendedorProd1.id,
        role: 'PUBLICA'
      }
    });

    // Profile adicional VENDEDOR sin QR productora 2
    testProfiles.vendedorSinQR = await prisma.profile.create({
      data: {
        userId: testUsers.vendedor.id,
        productoraId: testProductoras.prod2.id
        // Sin qrCode intencionalmente
      }
    });
    
    await prisma.roleAsignee.create({
      data: {
        profileId: testProfiles.vendedorSinQR.id,
        role: 'SUBPUBLICA'
      }
    });

    // Generar tokens JWT
    authTokens.superadmin = createTestToken(testUsers.superadmin.id);
    authTokens.owner1 = createTestToken(testUsers.owner1.id);
    authTokens.lider = createTestToken(testUsers.lider.id);
    authTokens.sinRoles = createTestToken(testUsers.sinRoles.id);

    // Crear eventos de prueba
    const evento1 = await prisma.eventos.create({
      data: {
        name: 'Concierto Rock',
        date: new Date('2025-06-15T20:00:00Z'),
        startTime: new Date('2025-06-15T20:00:00Z'),
        endTime: new Date('2025-06-15T23:00:00Z'),
        description: 'Gran concierto de rock',
        location: 'Estadio Nacional',
        capacity: 10000,
        productoraId: testProductoras.prod1.id,
        status: 'ACTIVO'
      }
    });

    // Crear tipos de entrada
    await prisma.tipoEntrada.create({
      data: {
        nombre: 'General',
        precio: 5000,
        eventoId: evento1.id,
        totalEntradas: 1000,
        maximoEntradasPorPersona: 4,
        estado: 'DISPONIBLE',
        disponible: true
      }
    });
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await prisma.roleAsignee.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.tipoEntrada.deleteMany();
    await prisma.eventos.deleteMany();
    await prisma.productora.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('GET /vendedores/mis-vendedores', () => {
    describe('🔒 Autenticación y autorización', () => {
      it('debe requerir autenticación', async () => {
        const response = await request(app)
          .get('/vendedores/mis-vendedores');

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error');
      });

      it('debe retornar 403 si el usuario no tiene permisos OWNER/LIDER', async () => {
        const response = await request(app)
          .get('/vendedores/mis-vendedores')
          .set('Cookie', `accessToken=${authTokens.sinRoles}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toContain('No tienes permisos para ver vendedores');
      });

      it('debe permitir acceso a usuarios OWNER', async () => {
        const response = await request(app)
          .get('/vendedores/mis-vendedores')
          .set('Cookie', `accessToken=${authTokens.owner1}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('vendedores');
        expect(response.body).toHaveProperty('misProductoras');
        expect(response.body.misProductoras).toEqual([testProductoras.prod1.id]);
      });

      it('debe permitir acceso a usuarios LIDER', async () => {
        const response = await request(app)
          .get('/vendedores/mis-vendedores')
          .set('Cookie', `accessToken=${authTokens.lider}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('vendedores');
        expect(response.body.misProductoras).toEqual([testProductoras.prod2.id]);
      });
    });

    describe('🎯 Filtros y consultas', () => {
      it('debe filtrar vendedores solo de las productoras del usuario OWNER', async () => {
        const response = await request(app)
          .get('/vendedores/mis-vendedores')
          .set('Cookie', `accessToken=${authTokens.owner1}`);

        expect(response.status).toBe(200);
        
        // Debe incluir solo vendedores de productora 1
        const vendedores = response.body.vendedores;
        expect(vendedores).toHaveLength(1);
        expect(vendedores[0].productoraId).toBe(testProductoras.prod1.id);
        expect(vendedores[0].productora.name).toBe('Productora Uno');
      });

      it('debe aplicar filtro hasQR=true correctamente', async () => {
        const response = await request(app)
          .get('/vendedores/mis-vendedores?hasQR=true')
          .set('Cookie', `accessToken=${authTokens.owner1}`);

        expect(response.status).toBe(200);
        
        const vendedores = response.body.vendedores;
        vendedores.forEach(vendedor => {
          expect(vendedor.qrCode).not.toBeNull();
        });
      });

      it('debe aplicar filtro por nombre de usuario', async () => {
        const response = await request(app)
          .get('/vendedores/mis-vendedores?name=Vendedor')
          .set('Cookie', `accessToken=${authTokens.owner1}`);

        expect(response.status).toBe(200);
        
        const vendedores = response.body.vendedores;
        vendedores.forEach(vendedor => {
          expect(vendedor.user.name.toLowerCase()).toContain('vendedor');
        });
      });

      it('debe aplicar paginación correctamente', async () => {
        const response = await request(app)
          .get('/vendedores/mis-vendedores?page=1&limit=1')
          .set('Cookie', `accessToken=${authTokens.owner1}`);

        expect(response.status).toBe(200);
        expect(response.body.pagination).toEqual({
          total: 1,
          page: 1,
          limit: 1,
          totalPages: 1
        });
      });
    });

    describe('📊 Estructura de respuesta', () => {
      it('debe retornar estructura completa de datos', async () => {
        const response = await request(app)
          .get('/vendedores/mis-vendedores')
          .set('Cookie', `accessToken=${authTokens.owner1}`);

        expect(response.status).toBe(200);
        
        const { vendedores, misProductoras, pagination } = response.body;
        
        expect(Array.isArray(vendedores)).toBe(true);
        expect(Array.isArray(misProductoras)).toBe(true);
        expect(pagination).toHaveProperty('total');
        expect(pagination).toHaveProperty('page');
        expect(pagination).toHaveProperty('limit');
        expect(pagination).toHaveProperty('totalPages');

        if (vendedores.length > 0) {
          const vendedor = vendedores[0];
          expect(vendedor).toHaveProperty('id');
          expect(vendedor).toHaveProperty('user');
          expect(vendedor).toHaveProperty('roles');
          expect(vendedor).toHaveProperty('productora');
          
          expect(vendedor.user).toHaveProperty('id');
          expect(vendedor.user).toHaveProperty('name');
          expect(vendedor.user).toHaveProperty('email');
          expect(vendedor.user).toHaveProperty('status');
          
          expect(vendedor.productora).toHaveProperty('id');
          expect(vendedor.productora).toHaveProperty('name');
          expect(vendedor.productora).toHaveProperty('code');
        }
      });
    });
  });

  describe('GET /vendedores/', () => {
    describe('🔒 Autenticación', () => {
      it('debe requerir autenticación', async () => {
        const response = await request(app)
          .get('/vendedores/');

        expect(response.status).toBe(401);
      });

      it('debe permitir acceso a usuarios autenticados', async () => {
        const response = await request(app)
          .get('/vendedores/')
          .set('Cookie', `accessToken=${authTokens.owner1}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('vendedores');
        expect(response.body).toHaveProperty('pagination');
      });
    });

    describe('🎯 Consultas y filtros', () => {
      it('debe retornar todos los vendedores de todas las productoras', async () => {
        const response = await request(app)
          .get('/vendedores/')
          .set('Cookie', `accessToken=${authTokens.owner1}`);

        expect(response.status).toBe(200);
        
        const vendedores = response.body.vendedores;
        expect(vendedores.length).toBeGreaterThanOrEqual(2); // Al menos 2 vendedores creados
        
        // Verificar que incluye vendedores de diferentes productoras
        const productoraIds = vendedores.map(v => v.productoraId);
        expect(productoraIds).toContain(testProductoras.prod1.id);
        expect(productoraIds).toContain(testProductoras.prod2.id);
      });

      it('debe filtrar por productora específica', async () => {
        const response = await request(app)
          .get(`/vendedores/?productoraId=${testProductoras.prod1.id}`)
          .set('Cookie', `accessToken=${authTokens.owner1}`);

        expect(response.status).toBe(200);
        
        const vendedores = response.body.vendedores;
        vendedores.forEach(vendedor => {
          expect(vendedor.productoraId).toBe(testProductoras.prod1.id);
        });
      });
    });
  });

  describe('GET /vendedores/productora/:productoraId', () => {
    describe('🎯 Consulta específica por productora', () => {
      it('debe obtener vendedores de productora específica', async () => {
        const response = await request(app)
          .get(`/vendedores/productora/${testProductoras.prod1.id}`)
          .set('Cookie', `accessToken=${authTokens.owner1}`);

        expect(response.status).toBe(200);
        
        const vendedores = response.body;
        expect(Array.isArray(vendedores)).toBe(true);
        vendedores.forEach(vendedor => {
          expect(vendedor.productoraId).toBe(testProductoras.prod1.id);
        });
      });

      it('debe aplicar filtros correctamente', async () => {
        const response = await request(app)
          .get(`/vendedores/productora/${testProductoras.prod2.id}?hasQR=false`)
          .set('Cookie', `accessToken=${authTokens.lider}`);

        expect(response.status).toBe(200);
        
        const vendedores = response.body;
        vendedores.forEach(vendedor => {
          expect(vendedor.qrCode).toBeNull();
        });
      });
    });
  });

  describe('GET /vendedores/qr/:qrCode/eventos', () => {
    describe('🎪 Consulta de eventos por QR de vendedor', () => {
      it('debe obtener eventos disponibles para el vendedor', async () => {
        // Esta ruta es pública, no requiere autenticación
        const response = await request(app)
          .get('/vendedores/qr/VENDEDOR-QR-003/eventos');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('vendedor');
        expect(response.body).toHaveProperty('eventos');
        
        expect(response.body.vendedor.name).toBe('Vendedor Test');
        expect(response.body.vendedor.productora).toBe('Productora Uno');
        
        const eventos = response.body.eventos;
        expect(Array.isArray(eventos)).toBe(true);
      });

      it('debe retornar solo eventos con tipos de entrada disponibles', async () => {
        const response = await request(app)
          .get('/vendedores/qr/VENDEDOR-QR-003/eventos');

        expect(response.status).toBe(200);
        
        const eventos = response.body.eventos;
        eventos.forEach(evento => {
          expect(evento.tipoEntrada.length).toBeGreaterThan(0);
          evento.tipoEntrada.forEach(tipo => {
            expect(tipo.disponible).toBe(true);
            expect(tipo.estado).toBe('DISPONIBLE');
          });
        });
      });

      it('debe aplicar filtros de consulta', async () => {
        const response = await request(app)
          .get('/vendedores/qr/VENDEDOR-QR-003/eventos?name=Rock');

        expect(response.status).toBe(200);
        
        const eventos = response.body.eventos;
        eventos.forEach(evento => {
          expect(evento.name.toLowerCase()).toContain('rock');
        });
      });
    });
  });

  describe('POST /vendedores/profile/:profileId/generar-qr', () => {
    describe('🔄 Generación de QR', () => {
      it('debe generar QR para un profile válido', async () => {
        // Usar un profile sin QR para la prueba
        const response = await request(app)
          .post(`/vendedores/profile/${testProfiles.vendedorSinQR.id}/generar-qr`)
          .set('Cookie', `accessToken=${authTokens.lider}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('profileId');
        expect(response.body).toHaveProperty('qrCode');
        expect(response.body).toHaveProperty('url');
        expect(response.body).toHaveProperty('message');
        
        expect(response.body.profileId).toBe(testProfiles.vendedorSinQR.id);
        expect(response.body.qrCode).toBeTruthy();
        expect(response.body.url).toContain('/vendedor/');
      });

      it('debe requerir autenticación', async () => {
        const response = await request(app)
          .post(`/vendedores/profile/${testProfiles.vendedorSinQR.id}/generar-qr`);

        expect(response.status).toBe(401);
      });
    });
  });
});