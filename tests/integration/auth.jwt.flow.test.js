import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createTestApp } from '../helpers/testApp.js';

const prisma = new PrismaClient();
const app = createTestApp();

describe('Auth JWT Complete Flow Tests', () => {
  let testUser;
  let cookies;

  beforeAll(async () => {
    // Limpiar datos de prueba
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'flow.test' } }
    });
  });

  afterAll(async () => {
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'flow.test' } }
    });
    await prisma.$disconnect();
  });

  describe('Flujo completo: Registro → Login → Acceso a recursos protegidos', () => {
    it('debe completar el flujo de registro y acceso', async () => {
      const userData = {
        name: 'Flow Test User',
        email: 'flow.test.complete@example.com',
        password: 'password123',
        lastName: 'Test'
      };

      // 1. Registro
      const registerResponse = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(registerResponse.body.message).toBe('Usuario registrado correctamente');
      
      // Extraer cookies del registro
      cookies = registerResponse.headers['set-cookie'];
      expect(cookies).toBeDefined();

      // 2. Acceder a recurso protegido con cookies del registro
      const meResponse = await request(app)
        .get('/auth/me')
        .set('Cookie', cookies)
        .expect(200);

      expect(meResponse.body.user.email).toBe(userData.email);
      expect(meResponse.body.user.status).toBe('ACTIVE');

      // 3. Logout
      const logoutResponse = await request(app)
        .post('/auth/logout')
        .set('Cookie', cookies)
        .expect(200);

      expect(logoutResponse.body.message).toBe('Sesión cerrada exitosamente');

      // 4. Intentar acceder después del logout (debe fallar)
      const unauthorizedResponse = await request(app)
        .get('/auth/me')
        .set('Cookie', cookies)
        .expect(401);

      expect(unauthorizedResponse.body.error).toBe('Token de acceso requerido');
    });
  });

  describe('Flujo de renovación de tokens', () => {
    beforeEach(async () => {
      // Crear usuario y hacer login
      const userData = {
        name: 'Refresh Test User',
        email: 'refresh.flow.test@example.com',
        password: 'password123'
      };

      const registerResponse = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      cookies = registerResponse.headers['set-cookie'];
    });

    it('debe renovar access token usando refresh token', async () => {
      // 1. Verificar acceso inicial
      const initialResponse = await request(app)
        .get('/auth/me')
        .set('Cookie', cookies)
        .expect(200);

      expect(initialResponse.body.user.email).toBe('refresh.flow.test@example.com');

      // 2. Renovar token
      const refreshResponse = await request(app)
        .post('/auth/refresh')
        .set('Cookie', cookies)
        .expect(200);

      expect(refreshResponse.body.message).toBe('Token renovado exitosamente');

      // Obtener nuevas cookies
      const newCookies = refreshResponse.headers['set-cookie'];
      expect(newCookies).toBeDefined();

      // 3. Verificar acceso con nuevo token
      const newAccessResponse = await request(app)
        .get('/auth/me')
        .set('Cookie', newCookies)
        .expect(200);

      expect(newAccessResponse.body.user.email).toBe('refresh.flow.test@example.com');
    });
  });

  describe('Flujo de seguridad: Protección de endpoints', () => {
    it('debe proteger endpoints que requieren autenticación', async () => {
      const protectedEndpoints = [
        { method: 'get', path: '/auth/me' },
        { method: 'post', path: '/auth/logout' }
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .expect(401);

        expect(response.body.error).toBe('Token de acceso requerido');
        expect(response.body.code).toBe('NO_TOKEN');
      }
    });

    it('debe rechazar tokens malformados', async () => {
      const malformedTokens = [
        'invalid_token',
        'Bearer invalid',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        ''
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .get('/auth/me')
          .set('Cookie', [`access_token=${token}`])
          .expect(401);

        expect(['Token inválido', 'Token de acceso requerido']).toContain(response.body.error);
      }
    });
  });

  describe('Flujo de seguridad de cookies', () => {
    it('debe configurar cookies con atributos de seguridad correctos', async () => {
      const userData = {
        name: 'Cookie Security User',
        email: 'cookiesecurity.flow.test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      const cookies = response.headers['set-cookie'];
      
      // Verificar atributos de seguridad
      const accessTokenCookie = cookies.find(cookie => cookie.includes('access_token'));
      const refreshTokenCookie = cookies.find(cookie => cookie.includes('refresh_token'));

      // HttpOnly
      expect(accessTokenCookie).toMatch(/HttpOnly/);
      expect(refreshTokenCookie).toMatch(/HttpOnly/);

      // SameSite
      expect(accessTokenCookie).toMatch(/SameSite=lax/);
      expect(refreshTokenCookie).toMatch(/SameSite=lax/);

      // MaxAge
      expect(accessTokenCookie).toMatch(/Max-Age=900/); // 15 minutos
      expect(refreshTokenCookie).toMatch(/Max-Age=604800/); // 7 días
    });
  });
});