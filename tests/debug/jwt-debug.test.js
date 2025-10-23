import { describe, it, beforeAll, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../helpers/testApp.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('🔍 Debug JWT Auth', () => {
  let authToken;

  beforeAll(async () => {
    // Crear usuario simple para test
    const user = await prisma.user.upsert({
      where: { email: 'debug@test.com' },
      update: {},
      create: {
        name: 'Debug User',
        email: 'debug@test.com',
        password: '$2b$10$rWaZZM7BZBOBsBKZeHjKIuqoTWpHnTM5InNLhRUqTGrD5Y1JLTSCu'
      }
    });

    // Intentar login
    const loginResponse = await request(app)
      .post('/auth/login-password')
      .send({
        email: 'debug@test.com',
        password: '123456'
      });

    console.log('🔍 Login response status:', loginResponse.status);
    console.log('🔍 Login response body:', JSON.stringify(loginResponse.body, null, 2));
    
    authToken = loginResponse.body.tokens?.accessToken;
    console.log('🔍 Token obtenido:', authToken?.substring(0, 100) + '...');
  });

  it('debe acceder a endpoint payment con token válido', async () => {
    console.log('🔍 Realizando petición a /payment');
    const response = await request(app)
      .get('/payment')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Content-Type', 'application/json');

    console.log('🔍 Response status:', response.status);
    console.log('🔍 Response body:', JSON.stringify(response.body, null, 2));
    
    expect(response.status).toBe(200);
  });

  it('debe fallar sin token', async () => {
    console.log('🔍 Realizando petición a /payment sin token');
    const response = await request(app)
      .get('/payment');

    console.log('🔍 Response status (sin token):', response.status);
    console.log('🔍 Response body (sin token):', JSON.stringify(response.body, null, 2));
    
    expect(response.status).toBe(401);
  });
});