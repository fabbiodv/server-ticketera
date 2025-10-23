import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import jwt from 'jsonwebtoken'

import { authenticateToken, optionalAuth, requireRole } from '../../src/middleware/auth.js'
import { createTestUser, createTestToken } from '../helpers/testHelpers.js'

describe('Auth Middleware - Unit Tests', () => {
  let req, res, next

  beforeEach(() => {
    req = {
      headers: {},
      cookies: {}
    }
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    }
    next = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('authenticateToken middleware', () => {
    it('should authenticate valid token from cookies', async () => {
      const userId = 1
      const role = 'USER'
      const token = createTestToken(userId, role)
      
      req.cookies.access_token = token

      await authenticateToken(req, res, next)

      expect(req.user).toBeDefined()
      expect(req.user.userId).toBe(userId)
      expect(req.user.role).toBe(role)
      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })

    it('should authenticate valid token from Authorization header', async () => {
      const userId = 2
      const role = 'ADMIN'
      const token = createTestToken(userId, role)
      
      req.headers.authorization = `Bearer ${token}`

      await authenticateToken(req, res, next)

      expect(req.user).toBeDefined()
      expect(req.user.userId).toBe(userId)
      expect(req.user.role).toBe(role)
      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })

    it('should return 401 when no token provided', async () => {
      await authenticateToken(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Token de acceso requerido' })
      expect(next).not.toHaveBeenCalled()
    })

    it('should return 403 for invalid token', async () => {
      req.cookies.access_token = 'invalid-token'

      await authenticateToken(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido' })
      expect(next).not.toHaveBeenCalled()
    })

    it('should return 401 for expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: 1, role: 'USER' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Token expirado
      )
      
      req.cookies.access_token = expiredToken

      await authenticateToken(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Token expirado' })
      expect(next).not.toHaveBeenCalled()
    })

    it('should prioritize cookie token over header token', async () => {
      const cookieToken = createTestToken(1, 'USER')
      const headerToken = createTestToken(2, 'ADMIN')
      
      req.cookies.access_token = cookieToken
      req.headers.authorization = `Bearer ${headerToken}`

      await authenticateToken(req, res, next)

      expect(req.user.userId).toBe(1) // Should use cookie token
      expect(req.user.role).toBe('USER')
      expect(next).toHaveBeenCalled()
    })
  })

  describe('optionalAuth middleware', () => {
    it('should authenticate valid token when provided', async () => {
      const userId = 1
      const role = 'USER'
      const token = createTestToken(userId, role)
      
      req.cookies.access_token = token

      await optionalAuth(req, res, next)

      expect(req.user).toBeDefined()
      expect(req.user.userId).toBe(userId)
      expect(req.user.role).toBe(role)
      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })

    it('should continue without authentication when no token provided', async () => {
      await optionalAuth(req, res, next)

      expect(req.user).toBeUndefined()
      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })

    it('should continue without authentication when invalid token provided', async () => {
      req.cookies.access_token = 'invalid-token'

      await optionalAuth(req, res, next)

      expect(req.user).toBeUndefined()
      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })

    it('should authenticate from Authorization header when no cookie', async () => {
      const userId = 3
      const role = 'MODERATOR'
      const token = createTestToken(userId, role)
      
      req.headers.authorization = `Bearer ${token}`

      await optionalAuth(req, res, next)

      expect(req.user).toBeDefined()
      expect(req.user.userId).toBe(userId)
      expect(req.user.role).toBe(role)
      expect(next).toHaveBeenCalled()
    })
  })

  describe('requireRole middleware', () => {
    beforeEach(() => {
      req.user = { userId: 1, role: 'USER' }
    })

    it('should allow access for user with required role', async () => {
      const middleware = requireRole('USER')
      
      await middleware(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })

    it('should allow access for user with any of the required roles (array)', async () => {
      req.user.role = 'ADMIN'
      const middleware = requireRole(['USER', 'ADMIN', 'MODERATOR'])
      
      await middleware(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })

    it('should deny access for user without required role', async () => {
      const middleware = requireRole('ADMIN')
      
      await middleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ error: 'Permisos insuficientes' })
      expect(next).not.toHaveBeenCalled()
    })

    it('should deny access when user is not authenticated', async () => {
      req.user = undefined
      const middleware = requireRole('USER')
      
      await middleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Autenticación requerida' })
      expect(next).not.toHaveBeenCalled()
    })

    it('should handle single role as string', async () => {
      req.user.role = 'ADMIN'
      const middleware = requireRole('ADMIN')
      
      await middleware(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })

    it('should handle multiple roles as array', async () => {
      req.user.role = 'MODERATOR'
      const middleware = requireRole(['USER', 'MODERATOR'])
      
      await middleware(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })

    it('should be case sensitive for roles', async () => {
      req.user.role = 'user' // lowercase
      const middleware = requireRole('USER') // uppercase
      
      await middleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ error: 'Permisos insuficientes' })
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('Middleware Chaining', () => {
    it('should work correctly when chained together', async () => {
      const userId = 1
      const role = 'ADMIN'
      const token = createTestToken(userId, role)
      
      req.cookies.access_token = token

      // First apply authentication
      await authenticateToken(req, res, next)
      expect(next).toHaveBeenCalledTimes(1)
      expect(req.user).toBeDefined()

      // Reset next for second middleware
      next.mockClear()

      // Then apply role requirement
      const roleMiddleware = requireRole('ADMIN')
      await roleMiddleware(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)
      expect(res.status).not.toHaveBeenCalled()
    })

    it('should stop chain when authentication fails', async () => {
      req.cookies.access_token = 'invalid-token'

      // Authentication should fail
      await authenticateToken(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(next).not.toHaveBeenCalled()
      expect(req.user).toBeUndefined()
    })

    it('should stop chain when role requirement fails', async () => {
      const userId = 1
      const role = 'USER'
      const token = createTestToken(userId, role)
      
      req.cookies.access_token = token

      // Authentication should succeed
      await authenticateToken(req, res, next)
      expect(req.user).toBeDefined()
      
      // Reset mocks
      res.status.mockClear()
      res.json.mockClear()
      next.mockClear()

      // Role requirement should fail
      const roleMiddleware = requireRole('ADMIN')
      await roleMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('should handle malformed Authorization header', async () => {
      req.headers.authorization = 'InvalidFormat'

      await authenticateToken(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Token de acceso requerido' })
    })

    it('should handle Authorization header without Bearer prefix', async () => {
      const token = createTestToken(1, 'USER')
      req.headers.authorization = token // Sin "Bearer "

      await authenticateToken(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Token de acceso requerido' })
    })

    it('should handle empty token string', async () => {
      req.cookies.access_token = ''

      await authenticateToken(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Token de acceso requerido' })
    })

    it('should handle null/undefined cookies', async () => {
      req.cookies = null

      await authenticateToken(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Token de acceso requerido' })
    })

    it('should handle token with invalid signature', async () => {
      const invalidToken = jwt.sign(
        { userId: 1, role: 'USER' },
        'wrong-secret', // Different secret
        { expiresIn: '1h' }
      )
      
      req.cookies.access_token = invalidToken

      await authenticateToken(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido' })
    })
  })
})
