import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { createTestApp } from '../helpers/testApp.js';

const prisma = new PrismaClient();
const app = createTestApp();

describe('Auth JWT & Cookies Tests', () => {
  let testUser;
  let validToken;
  let validRefreshToken;

  beforeAll(async () => {
    // Limpiar datos de prueba antes de comenzar
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'test' } }
    });
  });

  afterAll(async () => {
    // Limpiar después de los tests
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'test' } }
    });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    // Mock para sendEmail
    vi.mock('../../src/config/email.js', () => ({
      default: {
        sendEmail: vi.fn().mockResolvedValue(true)
      }
    }));
  });

  describe('POST /auth/register', () => {
    it('debe registrar un nuevo usuario correctamente', async () => {
      const userData = {
        name: 'Test User',
        email: 'test.register@example.com',
        password: 'password123',
        lastName: 'Test',
        phone: '+1234567890'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.message).toBe('Usuario registrado correctamente');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe(userData.email);
      
      // Verificar cookies
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(cookie => cookie.includes('access_token'))).toBe(true);
      expect(cookies.some(cookie => cookie.includes('refresh_token'))).toBe(true);
      
      // Verificar que se creó la sesión en BD
      const session = await prisma.session.findFirst({
        where: { user: { email: userData.email } }
      });
      expect(session).toBeDefined();
      expect(session.isValid).toBe(true);
    });

    it('debe fallar si el email ya existe', async () => {
      const userData = {
        email: 'test.register@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('El usuario ya existe');
    });

    it('debe fallar si la contraseña es muy corta', async () => {
      const userData = {
        email: 'test.short@example.com',
        password: '123'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('La contraseña debe tener al menos 8 caracteres');
    });

    it('debe fallar si faltan campos requeridos', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body.error).toBe('Email y contraseña son requeridos');
    });
  });

  describe('POST /auth/login', () => {
    it('debe enviar magic link correctamente', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test.login@example.com' })
        .expect(200);

      expect(response.body.message).toBe('Se ha enviado un enlace de acceso a tu email');
      expect(response.body.email).toBe('test.login@example.com');

      // Verificar que se creó/actualizó el usuario con magic link
      const user = await prisma.user.findUnique({
        where: { email: 'test.login@example.com' }
      });
      expect(user).toBeDefined();
      expect(user.magicLinkToken).toBeDefined();
      expect(user.tokenExpiry).toBeDefined();
    });

    it('debe fallar si no se proporciona email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Email es requerido');
    });
  });

  describe('POST /auth/login-password', () => {
    beforeEach(async () => {
      // Crear usuario de prueba
      const hashedPassword = await bcrypt.hash('password123', 12);
      testUser = await prisma.user.create({
        data: {
          name: 'Test Login User',
          email: 'test.login.password@example.com',
          password: hashedPassword,
          status: 'ACTIVE'
        }
      });
    });

    it('debe hacer login correctamente con credenciales válidas', async () => {
      const response = await request(app)
        .post('/auth/login-password')
        .send({
          email: 'test.login.password@example.com',
          password: 'password123'
        })
        .expect(200);

      expect(response.body.message).toBe('Login exitoso');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe('test.login.password@example.com');

      // Verificar cookies
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(cookie => cookie.includes('access_token'))).toBe(true);
      expect(cookies.some(cookie => cookie.includes('refresh_token'))).toBe(true);

      // Verificar configuración de cookies
      const accessTokenCookie = cookies.find(cookie => cookie.includes('access_token'));
      expect(accessTokenCookie).toMatch(/HttpOnly/);
      expect(accessTokenCookie).toMatch(/SameSite=lax/);
    });

    it('debe fallar con credenciales inválidas', async () => {
      const response = await request(app)
        .post('/auth/login-password')
        .send({
          email: 'test.login.password@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.error).toBe('Credenciales inválidas');
    });

    it('debe fallar si el usuario está suspendido', async () => {
      await prisma.user.update({
        where: { id: testUser.id },
        data: { status: 'SUSPENDED' }
      });

      const response = await request(app)
        .post('/auth/login-password')
        .send({
          email: 'test.login.password@example.com',
          password: 'password123'
        })
        .expect(401);

      expect(response.body.error).toBe('Cuenta suspendida o bloqueada');
    });
  });

  describe('GET /auth/verify', () => {
    let magicLinkToken;

    beforeEach(async () => {
      // Crear token válido
      magicLinkToken = jwt.sign(
        { email: 'test.verify@example.com', timestamp: Date.now() },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      await prisma.user.upsert({
        where: { email: 'test.verify@example.com' },
        update: {
          magicLinkToken,
          tokenExpiry: new Date(Date.now() + 3600000)
        },
        create: {
          email: 'test.verify@example.com',
          magicLinkToken,
          tokenExpiry: new Date(Date.now() + 3600000),
          status: 'PENDING_VERIFICATION'
        }
      });
    });

    it('debe verificar magic link y redireccionar correctamente', async () => {
      const response = await request(app)
        .get(`/auth/verify?token=${magicLinkToken}`)
        .expect(302);

      expect(response.headers.location).toBe(`${process.env.FRONTEND_URL}/auth/callback?status=success`);

      // Verificar que se limpiaron los tokens y se actualizó el estado
      const user = await prisma.user.findUnique({
        where: { email: 'test.verify@example.com' }
      });
      expect(user.magicLinkToken).toBeNull();
      expect(user.tokenExpiry).toBeNull();
      expect(user.status).toBe('ACTIVE');
      expect(user.lastLogin).toBeDefined();
    });

    it('debe fallar con token inválido', async () => {
      const response = await request(app)
        .get('/auth/verify?token=invalid_token')
        .expect(302);

      expect(response.headers.location).toBe(`${process.env.FRONTEND_URL}/login?error=invalid_token`);
    });

    it('debe fallar sin token', async () => {
      const response = await request(app)
        .get('/auth/verify')
        .expect(302);

      expect(response.headers.location).toBe(`${process.env.FRONTEND_URL}/login?error=missing_token`);
    });
  });

  describe('POST /auth/refresh', () => {
    beforeEach(async () => {
      // Crear usuario y sesión válida
      testUser = await prisma.user.create({
        data: {
          name: 'Test Refresh User',
          email: 'test.refresh@example.com',
          status: 'ACTIVE'
        }
      });

      validRefreshToken = jwt.sign(
        { userId: testUser.id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
      );

      await prisma.session.create({
        data: {
          userId: testUser.id,
          refreshToken: validRefreshToken,
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isValid: true
        }
      });
    });

    it('debe renovar access token correctamente', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .set('Cookie', [`refresh_token=${validRefreshToken}`])
        .expect(200);

      expect(response.body.message).toBe('Token renovado exitosamente');
      expect(response.body.user).toHaveProperty('id');

      // Verificar nueva cookie de access token
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(cookie => cookie.includes('access_token'))).toBe(true);
    });

    it('debe fallar sin refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .expect(401);

      expect(response.body.error).toBe('Refresh token no proporcionado');
    });

    it('debe fallar con sesión inválida', async () => {
      await prisma.session.updateMany({
        where: { refreshToken: validRefreshToken },
        data: { isValid: false }
      });

      const response = await request(app)
        .post('/auth/refresh')
        .set('Cookie', [`refresh_token=${validRefreshToken}`])
        .expect(401);

      expect(response.body.error).toBe('Sesión inválida o expirada');
    });
  });

  describe('POST /auth/logout', () => {
    beforeEach(async () => {
      testUser = await prisma.user.create({
        data: {
          name: 'Test Logout User',
          email: 'test.logout@example.com',
          status: 'ACTIVE'
        }
      });

      validRefreshToken = jwt.sign(
        { userId: testUser.id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
      );

      await prisma.session.create({
        data: {
          userId: testUser.id,
          refreshToken: validRefreshToken,
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isValid: true
        }
      });
    });

    it('debe cerrar sesión correctamente', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Cookie', [`refresh_token=${validRefreshToken}`])
        .expect(200);

      expect(response.body.message).toBe('Sesión cerrada exitosamente');

      // Verificar que se limpian las cookies
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(cookie => cookie.includes('access_token=;'))).toBe(true);
      expect(cookies.some(cookie => cookie.includes('refresh_token=;'))).toBe(true);

      // Verificar que se invalida la sesión
      const session = await prisma.session.findFirst({
        where: { refreshToken: validRefreshToken }
      });
      expect(session.isValid).toBe(false);
    });
  });

  describe('GET /auth/me', () => {
    beforeEach(async () => {
      testUser = await prisma.user.create({
        data: {
          name: 'Test Me User',
          email: 'test.me@example.com',
          status: 'ACTIVE'
        }
      });

      validToken = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
    });

    it('debe obtener información del usuario autenticado', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Cookie', [`access_token=${validToken}`])
        .expect(200);

      expect(response.body.user).toHaveProperty('id', testUser.id);
      expect(response.body.user.email).toBe('test.me@example.com');
      expect(response.body.user).toHaveProperty('profiles');
    });

    it('debe fallar sin token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .expect(401);

      expect(response.body.error).toBe('Token de acceso requerido');
      expect(response.body.code).toBe('NO_TOKEN');
    });

    it('debe fallar con token inválido', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Cookie', ['access_token=invalid_token'])
        .expect(401);

      expect(response.body.error).toBe('Token inválido');
      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    it('debe fallar con token expirado', async () => {
      const expiredToken = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/auth/me')
        .set('Cookie', [`access_token=${expiredToken}`])
        .expect(401);

      expect(response.body.error).toBe('Token expirado');
      expect(response.body.code).toBe('EXPIRED_TOKEN');
    });
  });
});