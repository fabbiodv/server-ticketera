import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createTestApp } from '../helpers/testApp.js';

const prisma = new PrismaClient();
const app = createTestApp();

describe('Auth JWT Simple Tests', () => {
  let testUser;
  let cookies;

  beforeAll(async () => {
    // Limpiar la base de datos antes de todos los tests
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'simple.test' } }
    });
  });

  afterAll(async () => {
    // Limpiar después de todos los tests
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'simple.test' } }
    });
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Limpiar después de cada test
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'simple.test' } }
    });
  });

  describe('POST /auth/register', () => {
    it('debe registrar un nuevo usuario correctamente', async () => {
      const userData = {
        name: 'Simple Test User',
        email: 'simple.test.register@example.com',
        password: 'password123',
        lastName: 'Test'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.message).toBe('Usuario registrado correctamente');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.name).toBe(userData.name);
      expect(response.body.user.status).toBe('ACTIVE');

      // Verificar que se configuraron las cookies
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(cookie => cookie.includes('access_token'))).toBe(true);
      expect(cookies.some(cookie => cookie.includes('refresh_token'))).toBe(true);

      // Verificar que el usuario fue creado en la base de datos
      const userInDb = await prisma.user.findUnique({
        where: { email: userData.email }
      });
      expect(userInDb).toBeDefined();
      expect(userInDb.status).toBe('ACTIVE');
    });

    it('debe fallar si el email ya existe', async () => {
      const userData = {
        name: 'Duplicate User',
        email: 'simple.test.duplicate@example.com',
        password: 'password123',
        lastName: 'Test'
      };

      // Crear usuario primero
      await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      // Intentar crear el mismo usuario otra vez
      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('El usuario ya existe');
    });
  });

  describe('POST /auth/login', () => {
    it('debe enviar magic link correctamente para usuario existente', async () => {
      // Crear usuario primero
      const userData = {
        name: 'Login Test User',
        email: 'simple.test.login@example.com',
        password: 'password123',
        lastName: 'Test'
      };

      await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      // Intentar hacer login con magic link
      const response = await request(app)
        .post('/auth/login')
        .send({ email: userData.email })
        .expect(200);

      expect(response.body.message).toBe('Magic link enviado correctamente');
    });

    it('debe fallar si no se proporciona email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Email es requerido');
    });
  });

  describe('GET /auth/me', () => {
    beforeEach(async () => {
      // Crear usuario y obtener cookies para cada test
      const userData = {
        name: 'Me Test User',
        email: 'simple.test.me@example.com',
        password: 'password123',
        lastName: 'Test'
      };

      const registerResponse = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      cookies = registerResponse.headers['set-cookie'];
      testUser = registerResponse.body.user;
    });

    it('debe obtener información del usuario autenticado', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.name).toBe(testUser.name);
      expect(response.body.user.id).toBe(testUser.id);
    });

    it('debe fallar sin token de acceso', async () => {
      const response = await request(app)
        .get('/auth/me')
        .expect(401);

      expect(response.body.error).toBe('Token de acceso requerido');
    });
  });

  describe('POST /auth/refresh', () => {
    beforeEach(async () => {
      // Crear usuario y obtener cookies
      const userData = {
        name: 'Refresh Test User',
        email: 'simple.test.refresh@example.com',
        password: 'password123',
        lastName: 'Test'
      };

      const registerResponse = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      cookies = registerResponse.headers['set-cookie'];
      testUser = registerResponse.body.user;
    });

    it('debe renovar access token correctamente', async () => {
      // Esperar un momento para que el access token sea diferente
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await request(app)
        .post('/auth/refresh')
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.message).toBe('Token renovado exitosamente');

      // Verificar que se obtuvieron nuevas cookies
      const newCookies = response.headers['set-cookie'];
      expect(newCookies).toBeDefined();
      expect(newCookies.some(cookie => cookie.includes('access_token'))).toBe(true);
    });

    it('debe fallar sin refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .expect(401);

      expect(response.body.error).toBe('Refresh token requerido');
    });
  });

  describe('POST /auth/logout', () => {
    beforeEach(async () => {
      // Crear usuario y obtener cookies
      const userData = {
        name: 'Logout Test User',
        email: 'simple.test.logout@example.com',
        password: 'password123',
        lastName: 'Test'
      };

      const registerResponse = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      cookies = registerResponse.headers['set-cookie'];
    });

    it('debe cerrar sesión correctamente', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.message).toBe('Sesión cerrada exitosamente');

      // Verificar que el refresh token ya no funciona después del logout
      await request(app)
        .post('/auth/refresh')
        .set('Cookie', cookies)
        .expect(401);
    });
  });
});