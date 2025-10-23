import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { 
  authenticateToken, 
  authMiddleware, 
  requireRoles,
  requireProductoraAccess,
  optionalAuth 
} from '../../src/middlewares/authMiddleware.js';

const prisma = new PrismaClient();

describe('Auth Middleware Tests', () => {
  let testUser;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeAll(async () => {
    // Limpiar datos de prueba
    await prisma.roleAsignee.deleteMany({});
    await prisma.profile.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'middleware.test' } }
    });
    await prisma.productora.deleteMany({
      where: { code: { contains: 'TEST' } }
    });
  });

  afterAll(async () => {
    await prisma.roleAsignee.deleteMany({});
    await prisma.profile.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'middleware.test' } }
    });
    await prisma.productora.deleteMany({
      where: { code: { contains: 'TEST' } }
    });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    mockReq = {
      cookies: {},
      headers: {},
      user: null
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    mockNext = vi.fn();
  });

  describe('authenticateToken', () => {
    beforeEach(async () => {
      // Crear usuario de prueba
      testUser = await prisma.user.create({
        data: {
          name: 'Middleware Test User',
          email: 'middleware.test@example.com',
          status: 'ACTIVE'
        }
      });
    });

    it('debe autenticar correctamente con token en cookie', async () => {
      const token = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      mockReq.cookies.access_token = token;

      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.userId).toBe(testUser.id);
      expect(mockReq.user.email).toBe('middleware.test@example.com');
    });

    it('debe autenticar correctamente con token en header Authorization', async () => {
      const token = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      mockReq.headers.authorization = `Bearer ${token}`;

      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.userId).toBe(testUser.id);
    });

    it('debe fallar sin token', async () => {
      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Token de acceso requerido',
        code: 'NO_TOKEN'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('debe fallar con token expirado', async () => {
      const expiredToken = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      mockReq.cookies.access_token = expiredToken;

      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Token expirado',
        code: 'EXPIRED_TOKEN'
      });
    });

    it('debe fallar con token inválido', async () => {
      mockReq.cookies.access_token = 'invalid_token';

      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Token inválido',
        code: 'INVALID_TOKEN'
      });
    });

    it('debe fallar con usuario inexistente', async () => {
      const token = jwt.sign(
        { userId: 99999 }, // ID que no existe
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      mockReq.cookies.access_token = token;

      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Usuario no válido',
        code: 'INVALID_USER'
      });
    });

    it('debe fallar con usuario inactivo', async () => {
      await prisma.user.update({
        where: { id: testUser.id },
        data: { status: 'SUSPENDED' }
      });

      const token = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      mockReq.cookies.access_token = token;

      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Usuario inactivo',
        code: 'INACTIVE_USER'
      });
    });
  });

  describe('requireRoles', () => {
    let testProductora;
    let testProfile;

    beforeEach(async () => {
      // Crear estructura completa para pruebas de roles
      testUser = await prisma.user.create({
        data: {
          name: 'Roles Test User',
          email: 'roles.middleware.test@example.com',
          status: 'ACTIVE'
        }
      });

      testProductora = await prisma.productora.create({
        data: {
          name: 'Test Productora Middleware',
          email: 'test.middleware@productora.com',
          code: 'TESTMW001',
          status: 'activa'
        }
      });

      testProfile = await prisma.profile.create({
        data: {
          userId: testUser.id,
          productoraId: testProductora.id
        }
      });

      await prisma.roleAsignee.create({
        data: {
          profileId: testProfile.id,
          role: 'PUBLICA'
        }
      });

      // Simular usuario autenticado con roles
      mockReq.user = {
        userId: testUser.id,
        email: testUser.email,
        profiles: [{
          id: testProfile.id,
          productoraId: testProductora.id,
          roles: [{ role: 'PUBLICA' }]
        }]
      };
    });

    it('debe permitir acceso con rol válido', async () => {
      const middleware = requireRoles(['PUBLICA', 'LIDER']);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('debe denegar acceso sin rol válido', async () => {
      const middleware = requireRoles(['SUPERADMIN', 'OWNER']);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'No tienes permisos suficientes',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: ['SUPERADMIN', 'OWNER'],
        userRoles: ['PUBLICA']
      });
    });

    it('debe fallar sin usuario autenticado', async () => {
      mockReq.user = null;
      const middleware = requireRoles(['PUBLICA']);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Usuario no autenticado',
        code: 'NOT_AUTHENTICATED'
      });
    });
  });

  describe('requireProductoraAccess', () => {
    let testProductora;
    let testProfile;

    beforeEach(async () => {
      testUser = await prisma.user.create({
        data: {
          name: 'Productora Access Test User',
          email: 'productora.middleware.test@example.com',
          status: 'ACTIVE'
        }
      });

      testProductora = await prisma.productora.create({
        data: {
          name: 'Test Productora Access',
          email: 'test.access@productora.com',
          code: 'TESTACC001',
          status: 'activa'
        }
      });

      testProfile = await prisma.profile.create({
        data: {
          userId: testUser.id,
          productoraId: testProductora.id
        }
      });

      mockReq.user = {
        userId: testUser.id,
        profiles: [{
          id: testProfile.id,
          productora: {
            id: testProductora.id,
            name: testProductora.name,
            code: testProductora.code
          },
          roles: [{ role: 'PUBLICA' }]
        }]
      };
    });

    it('debe permitir acceso a productora válida', async () => {
      mockReq.params = { productoraId: testProductora.id.toString() };
      const middleware = requireProductoraAccess();

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.productora).toBeDefined();
      expect(mockReq.productora.id).toBe(testProductora.id);
      expect(mockReq.userRoles).toEqual(['PUBLICA']);
    });

    it('debe denegar acceso a productora no autorizada', async () => {
      mockReq.params = { productoraId: '99999' };
      const middleware = requireProductoraAccess();

      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'No tienes acceso a esta productora',
        code: 'NO_PRODUCTORA_ACCESS'
      });
    });

    it('debe fallar sin ID de productora', async () => {
      mockReq.params = {};
      const middleware = requireProductoraAccess();

      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'ID de productora requerido',
        code: 'MISSING_PRODUCTORA_ID'
      });
    });
  });

  describe('optionalAuth', () => {
    beforeEach(async () => {
      testUser = await prisma.user.create({
        data: {
          name: 'Optional Auth Test User',
          email: 'optional.middleware.test@example.com',
          status: 'ACTIVE'
        }
      });
    });

    it('debe autenticar si hay token válido', async () => {
      const token = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      mockReq.cookies.access_token = token;

      await optionalAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.userId).toBe(testUser.id);
    });

    it('debe continuar sin usuario si no hay token', async () => {
      await optionalAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeNull();
    });

    it('debe continuar sin usuario si hay token inválido', async () => {
      mockReq.cookies.access_token = 'invalid_token';

      await optionalAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeNull();
    });
  });

  describe('authMiddleware alias', () => {
    it('debe ser igual a authenticateToken', () => {
      expect(authMiddleware).toBe(authenticateToken);
    });
  });
});