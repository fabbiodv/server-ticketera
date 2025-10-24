import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

import { createTestApp } from '../helpers/testApp.js'
import { 
  createTestUser, 
  cleanDatabase, 
  expectErrorResponse, 
  expectSuccessResponse,
  createAuthCookies
} from '../helpers/testHelpers.js'
import { authFixtures, userFixtures } from '../fixtures/testData.js'

describe('Auth Controller - Unit Tests', () => {
  let app

  beforeEach(async () => {
    app = createTestApp()
    await cleanDatabase()
  })

  afterEach(async () => {
    await cleanDatabase()
  })

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = userFixtures.validUser

      const response = await request(app)
        .post('/auth/register')
        .send(userData)

      expectSuccessResponse(response, 201)
      expect(response.body).toHaveProperty('message', 'Usuario registrado correctamente')
      expect(response.body).toHaveProperty('user')
      // Los tokens se envían como cookies, no en el body
      
      // Verificar que el usuario se guardó en la base de datos
      const savedUser = await global.testPrisma.user.findUnique({
        where: { email: userData.email }
      })
      expect(savedUser).toBeTruthy()
      expect(savedUser.email).toBe(userData.email)
      expect(savedUser.name).toBe(userData.name)
    })

    it('should not register user with existing email', async () => {
      const userData = userFixtures.validUser
      
      // Crear usuario primero
      await createTestUser(userData)

      // Intentar crear otro usuario con el mismo email
      const response = await request(app)
        .post('/auth/register')
        .send(userData)

      expectErrorResponse(response, 400, 'El usuario ya existe')
    })

    it('should not register user without required fields', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({ email: 'test@example.com' }) // Falta password

      expectErrorResponse(response, 400, 'Email y contraseña son requeridos')
    })

    it('should hash password correctly', async () => {
      const userData = userFixtures.validUser

      await request(app)
        .post('/auth/register')
        .send(userData)

      const savedUser = await global.testPrisma.user.findUnique({
        where: { email: userData.email }
      })

      expect(savedUser.password).not.toBe(userData.password)
      
      // Verificar que la contraseña hasheada es válida
      const isValidPassword = await bcrypt.compare(userData.password, savedUser.password)
      expect(isValidPassword).toBe(true)
    })
  })

  describe('POST /auth/login', () => {
    it('should send magic link email successfully', async () => {
      const mockSendEmail = vi.fn().mockResolvedValue({ success: true })
      
      // Mock del módulo de email
      vi.doMock('../../../src/config/email.js', () => ({
        default: mockSendEmail
      }))

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com' })

      expectSuccessResponse(response, 200)
      expect(response.body).toHaveProperty('message', 'Magic link enviado correctamente')
      
      // Verificar que se guardó/actualizó el usuario con magic link token
      const user = await global.testPrisma.user.findUnique({
        where: { email: 'test@example.com' }
      })
      expect(user).toBeTruthy()
      expect(user.magicLinkToken).toBeTruthy()
      expect(user.tokenExpiry).toBeTruthy()
    })

    it('should handle email sending failure', async () => {
      const mockSendEmail = vi.fn().mockResolvedValue({ success: false })
      
      vi.doMock('../../../src/config/email.js', () => ({
        default: mockSendEmail
      }))

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com' })

      expectErrorResponse(response, 500, 'Error al enviar el email de acceso')
    })
  })

  describe('POST /auth/login-password', () => {
    it('should login successfully with valid credentials', async () => {
      const userData = userFixtures.validUser
      const user = await createTestUser(userData)

      const response = await request(app)
        .post('/auth/login-password')
        .send({
          email: userData.email,
          password: userData.password
        })

      expectSuccessResponse(response, 200)
      expect(response.body).toHaveProperty('user')
      expect(response.body).toHaveProperty('tokens')
      expect(response.body.user.id).toBe(user.id)
      expect(response.body.user.email).toBe(user.email)
      
      // Verificar que no se expone la contraseña
      expect(response.body.user).not.toHaveProperty('password')
      
      // Verificar que se establecieron las cookies
      const cookies = response.headers['set-cookie']
      expect(cookies).toBeDefined()
      expect(cookies.some(cookie => cookie.includes('access_token'))).toBe(true)
      expect(cookies.some(cookie => cookie.includes('refresh_token'))).toBe(true)
    })

    it('should fail with invalid credentials', async () => {
      const userData = userFixtures.validUser
      await createTestUser(userData)

      const response = await request(app)
        .post('/auth/login-password')
        .send({
          email: userData.email,
          password: 'wrongpassword'
        })

      expectErrorResponse(response, 401, 'Credenciales inválidas')
    })

    it('should fail with non-existent user', async () => {
      const response = await request(app)
        .post('/auth/login-password')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        })

      expectErrorResponse(response, 401, 'Credenciales inválidas')
    })

    it('should require email and password', async () => {
      const response = await request(app)
        .post('/auth/login-password')
        .send({ email: 'test@example.com' }) // Falta password

      expectErrorResponse(response, 400, 'Email y contraseña son requeridos')
    })

    it('should update lastLogin on successful login', async () => {
      const userData = userFixtures.validUser
      const user = await createTestUser(userData)

      await request(app)
        .post('/auth/login-password')
        .send({
          email: userData.email,
          password: userData.password
        })

      const updatedUser = await global.testPrisma.user.findUnique({
        where: { id: user.id }
      })

      expect(updatedUser.lastLogin).toBeTruthy()
      expect(new Date(updatedUser.lastLogin).getTime()).toBeGreaterThan(user.lastLogin?.getTime() || 0)
    })
  })

  describe('GET /auth/verify', () => {
    it('should verify valid magic link token', async () => {
      // Crear usuario con magic link token válido
      const email = 'test@example.com'
      const magicLinkToken = await bcrypt.hash(email + Date.now(), 10)
      const tokenExpiry = new Date(Date.now() + 3600000) // 1 hora

      const user = await global.testPrisma.user.create({
        data: {
          email,
          magicLinkToken,
          tokenExpiry
        }
      })

      const response = await request(app)
        .get(`/auth/verify?token=${magicLinkToken}`)

      expect(response.status).toBe(302) // Redirect
      expect(response.headers.location).toContain('auth/callback?status=success')

      // Verificar que se limpió el magic link token
      const updatedUser = await global.testPrisma.user.findUnique({
        where: { id: user.id }
      })
      expect(updatedUser.magicLinkToken).toBeNull()
      expect(updatedUser.tokenExpiry).toBeNull()
      expect(updatedUser.lastLogin).toBeTruthy()
    })

    it('should reject expired magic link token', async () => {
      const email = 'test@example.com'
      const magicLinkToken = await bcrypt.hash(email + Date.now(), 10)
      const tokenExpiry = new Date(Date.now() - 3600000) // Expirado hace 1 hora

      await global.testPrisma.user.create({
        data: {
          email,
          magicLinkToken,
          tokenExpiry
        }
      })

      const response = await request(app)
        .get(`/auth/verify?token=${magicLinkToken}`)

      expect(response.status).toBe(302) // Redirect
      expect(response.headers.location).toContain('login?error=invalid_token')
    })

    it('should reject invalid magic link token', async () => {
      const response = await request(app)
        .get('/auth/verify?token=invalid-token')

      expect(response.status).toBe(302) // Redirect
      expect(response.headers.location).toContain('login?error=invalid_token')
    })
  })

  describe('POST /auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const user = await createTestUser()
      const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
      )

      // Crear sesión válida
      await global.testPrisma.session.create({
        data: {
          userId: user.id,
          refreshToken,
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isValid: true
        }
      })

      const response = await request(app)
        .post('/auth/refresh')
        .set('Cookie', `refresh_token=${refreshToken}`)

      expectSuccessResponse(response, 200)
      expect(response.body).toHaveProperty('message', 'Token renovado exitosamente')
      
      // Verificar que se estableció nueva cookie de access token
      const cookies = response.headers['set-cookie']
      expect(cookies).toBeDefined()
      expect(cookies.some(cookie => cookie.includes('access_token'))).toBe(true)
    })

    it('should fail without refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')

      expectErrorResponse(response, 400, 'Refresh token requerido')
    })

    it('should fail with invalid refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .set('Cookie', 'refresh_token=invalid-token')

      expectErrorResponse(response, 401, 'Sesión inválida o expirada')
    })
  })

  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      const user = await createTestUser()
      const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
      )

      // Crear sesión
      await global.testPrisma.session.create({
        data: {
          userId: user.id,
          refreshToken,
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isValid: true
        }
      })

      const response = await request(app)
        .post('/auth/logout')
        .set('Cookie', `refresh_token=${refreshToken}`)

      expectSuccessResponse(response, 200)
      expect(response.body).toHaveProperty('message', 'Sesión cerrada exitosamente')

      // Verificar que la sesión fue invalidada
      const session = await global.testPrisma.session.findFirst({
        where: { refreshToken }
      })
      expect(session.isValid).toBe(false)
    })

    it('should logout even without active session', async () => {
      const response = await request(app)
        .post('/auth/logout')

      expectSuccessResponse(response, 200)
      expect(response.body).toHaveProperty('message', 'Sesión cerrada exitosamente')
    })
  })

  describe('GET /auth/session', () => {
    it('should get user session with valid token', async () => {
      const user = await createTestUser()
      const cookies = createAuthCookies(user.id, user.role)

      const response = await request(app)
        .get('/auth/session')
        .set('Cookie', [
          `access_token=${cookies.access_token}`,
          `refresh_token=${cookies.refresh_token}`
        ])

      expectSuccessResponse(response, 200)
      expect(response.body).toHaveProperty('user')
      expect(response.body.user.id).toBe(user.id)
      expect(response.body.user.email).toBe(user.email)
      expect(response.body.user).not.toHaveProperty('password')
    })

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/auth/session')

      expectErrorResponse(response, 401, 'Token de acceso requerido')
    })

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/auth/session')
        .set('Cookie', 'access_token=invalid-token')

      expectErrorResponse(response, 403, 'Token inválido')
    })
  })

  describe('POST /auth/update-password', () => {
    it('should update password for user with existing password', async () => {
      const userData = userFixtures.validUser
      const user = await createTestUser(userData)
      const cookies = createAuthCookies(user.id, user.role)

      const response = await request(app)
        .post('/auth/update-password')
        .set('Cookie', [
          `access_token=${cookies.access_token}`,
          `refresh_token=${cookies.refresh_token}`
        ])
        .send({
          currentPassword: userData.password,
          newPassword: 'newpassword123'
        })

      expectSuccessResponse(response, 200)
      expect(response.body).toHaveProperty('message', 'Contraseña actualizada correctamente')

      // Verificar que la contraseña se actualizó
      const updatedUser = await global.testPrisma.user.findUnique({
        where: { id: user.id }
      })
      const isNewPasswordValid = await bcrypt.compare('newpassword123', updatedUser.password)
      expect(isNewPasswordValid).toBe(true)
    })

    it('should fail with wrong current password', async () => {
      const userData = userFixtures.validUser
      const user = await createTestUser(userData)
      const cookies = createAuthCookies(user.id, user.role)

      const response = await request(app)
        .post('/auth/update-password')
        .set('Cookie', [
          `access_token=${cookies.access_token}`,
          `refresh_token=${cookies.refresh_token}`
        ])
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        })

      expectErrorResponse(response, 401, 'Contraseña actual incorrecta')
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/auth/update-password')
        .send({
          currentPassword: 'current',
          newPassword: 'newpassword123'
        })

      expectErrorResponse(response, 401, 'Token de acceso requerido')
    })

    it('should validate new password length', async () => {
      const userData = userFixtures.validUser
      const user = await createTestUser(userData)
      const cookies = createAuthCookies(user.id, user.role)

      const response = await request(app)
        .post('/auth/update-password')
        .set('Cookie', [
          `access_token=${cookies.access_token}`,
          `refresh_token=${cookies.refresh_token}`
        ])
        .send({
          currentPassword: userData.password,
          newPassword: '123' // Muy corta
        })

      expectErrorResponse(response, 400, 'La nueva contraseña debe tener al menos 8 caracteres')
    })
  })
})
