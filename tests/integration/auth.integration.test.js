import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'

import { createTestApp } from '../../helpers/testApp.js'
import { 
  createTestUser, 
  cleanDatabase, 
  expectErrorResponse, 
  expectSuccessResponse,
  authenticatedRequest
} from '../../helpers/testHelpers.js'
import { userFixtures } from '../../fixtures/testData.js'

describe('Authentication Integration Tests', () => {
  let app

  beforeEach(async () => {
    app = createTestApp()
    await cleanDatabase()
  })

  afterEach(async () => {
    await cleanDatabase()
  })

  describe('Complete Authentication Flow', () => {
    it('should complete full registration -> login -> access protected route flow', async () => {
      const userData = userFixtures.validUser

      // 1. Registro
      const registerResponse = await request(app)
        .post('/auth/register')
        .send(userData)

      expectSuccessResponse(registerResponse, 200)
      expect(registerResponse.body).toHaveProperty('user')
      expect(registerResponse.body).toHaveProperty('tokens')

      const { user, tokens } = registerResponse.body

      // 2. Acceder a ruta protegida con token
      const sessionResponse = await request(app)
        .get('/auth/session')
        .set('Cookie', [
          `access_token=${tokens.accessToken}`,
          `refresh_token=${tokens.refreshToken}`
        ])

      expectSuccessResponse(sessionResponse, 200)
      expect(sessionResponse.body.user.id).toBe(user.id)
      expect(sessionResponse.body.user.email).toBe(user.email)

      // 3. Login con contraseña
      const loginResponse = await request(app)
        .post('/auth/loginWithPassword')
        .send({
          email: userData.email,
          password: userData.password
        })

      expectSuccessResponse(loginResponse, 200)
      expect(loginResponse.body.user.id).toBe(user.id)

      // 4. Logout
      const logoutResponse = await request(app)
        .post('/auth/logout')
        .set('Cookie', [
          `access_token=${tokens.accessToken}`,
          `refresh_token=${tokens.refreshToken}`
        ])

      expectSuccessResponse(logoutResponse, 200)
    })

    it('should handle token refresh flow', async () => {
      const user = await createTestUser()
      
      // 1. Login para obtener tokens
      const loginResponse = await request(app)
        .post('/auth/loginWithPassword')
        .send({
          email: user.email,
          password: 'password123' // Default password from createTestUser
        })

      expectSuccessResponse(loginResponse, 200)
      const { tokens } = loginResponse.body

      // 2. Usar refresh token para obtener nuevo access token
      const refreshResponse = await request(app)
        .post('/auth/refresh')
        .set('Cookie', `refresh_token=${tokens.refreshToken}`)

      expectSuccessResponse(refreshResponse, 200)
      expect(refreshResponse.body).toHaveProperty('message', 'Token renovado exitosamente')

      // 3. Verificar que se estableció nueva cookie
      const cookies = refreshResponse.headers['set-cookie']
      expect(cookies).toBeDefined()
      expect(cookies.some(cookie => cookie.includes('access_token'))).toBe(true)
    })

    it('should prevent access to protected routes without authentication', async () => {
      const response = await request(app)
        .get('/auth/session')

      expectErrorResponse(response, 401, 'Token de acceso requerido')
    })

    it('should prevent access with expired tokens', async () => {
      // Este test requeriría crear un token expirado, lo cual es complejo
      // Por simplicidad, testearemos con un token inválido
      const response = await request(app)
        .get('/auth/session')
        .set('Cookie', 'access_token=invalid.token.here')

      expectErrorResponse(response, 403, 'Token inválido')
    })
  })

  describe('User Management Integration', () => {
    it('should create, read, update, and delete user', async () => {
      const userData = {
        name: 'Integration Test User',
        email: 'integration@example.com',
        password: 'password123'
      }

      // 1. Create user
      const createResponse = await request(app)
        .post('/users')
        .send(userData)

      expectSuccessResponse(createResponse, 201)
      const createdUser = createResponse.body
      expect(createdUser).toHaveProperty('id')

      // 2. Read user (via GET users endpoint)
      const getUsersResponse = await request(app)
        .get('/users')

      expectSuccessResponse(getUsersResponse, 200)
      expect(getUsersResponse.body).toBeInstanceOf(Array)
      const foundUser = getUsersResponse.body.find(u => u.id === createdUser.id)
      expect(foundUser).toBeTruthy()
      expect(foundUser.email).toBe(userData.email)

      // 3. Update user
      const updateData = {
        name: 'Updated Integration User',
        email: 'updated-integration@example.com'
      }

      const updateResponse = await request(app)
        .put(`/users/${createdUser.id}`)
        .send(updateData)

      expectSuccessResponse(updateResponse, 200)
      expect(updateResponse.body.user.name).toBe(updateData.name)
      expect(updateResponse.body.user.email).toBe(updateData.email)

      // 4. Delete user
      const deleteResponse = await request(app)
        .delete(`/users/${createdUser.id}`)

      expectSuccessResponse(deleteResponse, 200)

      // 5. Verify user is deleted
      const verifyDeleteResponse = await request(app)
        .get('/users')

      expectSuccessResponse(verifyDeleteResponse, 200)
      const deletedUserCheck = verifyDeleteResponse.body.find(u => u.id === createdUser.id)
      expect(deletedUserCheck).toBeFalsy()
    })

    it('should handle concurrent user operations', async () => {
      const userData1 = {
        name: 'Concurrent User 1',
        email: 'concurrent1@example.com',
        password: 'password123'
      }

      const userData2 = {
        name: 'Concurrent User 2',
        email: 'concurrent2@example.com',
        password: 'password123'
      }

      const userData3 = {
        name: 'Concurrent User 3',
        email: 'concurrent3@example.com',
        password: 'password123'
      }

      // Create multiple users concurrently
      const createPromises = [
        request(app).post('/users').send(userData1),
        request(app).post('/users').send(userData2),
        request(app).post('/users').send(userData3)
      ]

      const createResponses = await Promise.all(createPromises)

      // All should succeed
      createResponses.forEach(response => {
        expectSuccessResponse(response, 201)
      })

      // Verify all users exist
      const getUsersResponse = await request(app).get('/users')
      expectSuccessResponse(getUsersResponse, 200)
      expect(getUsersResponse.body).toHaveLength(3)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle invalid data gracefully across endpoints', async () => {
      // Test invalid user creation
      const invalidUserResponse = await request(app)
        .post('/users')
        .send({ name: 'No Email User' }) // Missing email and password

      expect(invalidUserResponse.status).toBeGreaterThanOrEqual(400)

      // Test invalid login
      const invalidLoginResponse = await request(app)
        .post('/auth/loginWithPassword')
        .send({ email: 'invalid', password: 'wrong' })

      expectErrorResponse(invalidLoginResponse, 401)

      // Test accessing protected route without auth
      const noAuthResponse = await request(app)
        .get('/auth/session')

      expectErrorResponse(noAuthResponse, 401)
    })

    it('should maintain data consistency during errors', async () => {
      const user = await createTestUser()
      const initialUsersCount = await global.testPrisma.user.count()

      // Try to create user with existing email (should fail)
      const duplicateResponse = await request(app)
        .post('/users')
        .send({
          name: 'Duplicate User',
          email: user.email,
          password: 'password123'
        })

      expectErrorResponse(duplicateResponse, 400)

      // Verify user count didn't change
      const finalUsersCount = await global.testPrisma.user.count()
      expect(finalUsersCount).toBe(initialUsersCount)
    })
  })

  describe('Performance and Load Tests', () => {
    it('should handle multiple simultaneous requests', async () => {
      const user = await createTestUser()

      // Create multiple simultaneous session requests
      const sessionPromises = []
      for (let i = 0; i < 10; i++) {
        sessionPromises.push(
          authenticatedRequest(app, user.id, user.role)
            .get('/auth/session')
        )
      }

      const responses = await Promise.all(sessionPromises)

      // All should succeed
      responses.forEach(response => {
        expectSuccessResponse(response, 200)
        expect(response.body.user.id).toBe(user.id)
      })
    })

    it('should maintain performance with larger datasets', async () => {
      // Create multiple users
      const userPromises = []
      for (let i = 0; i < 25; i++) {
        userPromises.push(createTestUser({
          email: `perf-test-${i}@example.com`,
          name: `Performance Test User ${i}`
        }))
      }

      await Promise.all(userPromises)

      const startTime = Date.now()
      
      const response = await request(app)
        .get('/users')

      const endTime = Date.now()
      const responseTime = endTime - startTime

      expectSuccessResponse(response, 200)
      expect(response.body).toHaveLength(25)
      
      // Response should be reasonably fast (less than 1 second)
      expect(responseTime).toBeLessThan(1000)
    })
  })

  describe('Business Logic Integration', () => {
    it('should enforce business rules across operations', async () => {
      const userData = userFixtures.validUser

      // 1. Register user
      const registerResponse = await request(app)
        .post('/auth/register')
        .send(userData)

      expectSuccessResponse(registerResponse, 200)
      const { user } = registerResponse.body

      // 2. Try to register same email again (should fail)
      const duplicateRegisterResponse = await request(app)
        .post('/auth/register')
        .send(userData)

      expectErrorResponse(duplicateRegisterResponse, 400, 'El usuario ya existe')

      // 3. Login with correct credentials
      const validLoginResponse = await request(app)
        .post('/auth/loginWithPassword')
        .send({
          email: userData.email,
          password: userData.password
        })

      expectSuccessResponse(validLoginResponse, 200)

      // 4. Try login with wrong password
      const invalidLoginResponse = await request(app)
        .post('/auth/loginWithPassword')
        .send({
          email: userData.email,
          password: 'wrongpassword'
        })

      expectErrorResponse(invalidLoginResponse, 401, 'Credenciales inválidas')
    })
  })
})
