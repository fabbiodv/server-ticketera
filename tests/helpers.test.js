import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import bcrypt from 'bcrypt'
import { cleanDatabase, createTestUser } from './helpers/testHelpers.js'

describe('Test Helpers - Validation', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterEach(async () => {
    await cleanDatabase()
  })

  describe('Database Helpers', () => {
    it('should create a test user', async () => {
      const user = await createTestUser({
        email: 'test@example.com',
        name: 'Test User'
      })

      expect(user).toBeDefined()
      expect(user.id).toBeDefined()
      expect(user.email).toBe('test@example.com')
      expect(user.name).toBe('Test User')
      expect(user.password).toBeDefined()

      // Verificar que la contraseña está hasheada
      const isPasswordHashed = await bcrypt.compare('password123', user.password)
      expect(isPasswordHashed).toBe(true)
    })

    it('should clean database properly', async () => {
      // Crear algunos usuarios
      await createTestUser({ email: 'user1@example.com' })
      await createTestUser({ email: 'user2@example.com' })

      // Verificar que existen
      let userCount = await global.testPrisma.user.count()
      expect(userCount).toBe(2)

      // Limpiar base de datos
      await cleanDatabase()

      // Verificar que se limpiaron
      userCount = await global.testPrisma.user.count()
      expect(userCount).toBe(0)
    })

    it('should handle concurrent user creation', async () => {
      const userPromises = [
        createTestUser({ email: 'concurrent1@example.com' }),
        createTestUser({ email: 'concurrent2@example.com' }),
        createTestUser({ email: 'concurrent3@example.com' })
      ]

      const users = await Promise.all(userPromises)

      expect(users).toHaveLength(3)
      users.forEach((user, index) => {
        expect(user.id).toBeDefined()
        expect(user.email).toBe(`concurrent${index + 1}@example.com`)
      })
    })
  })

  describe('Environment Setup', () => {
    it('should have test environment variables configured', () => {
      expect(process.env.NODE_ENV).toBe('test')
      expect(process.env.JWT_SECRET).toBeDefined()
      expect(process.env.REFRESH_TOKEN_SECRET).toBeDefined()
      expect(process.env.BACKEND_URL).toBeDefined()
      expect(process.env.LOCAL_FRONTEND_URL).toBeDefined()
    })

    it('should have global test Prisma instance', () => {
      expect(global.testPrisma).toBeDefined()
      expect(typeof global.testPrisma.$connect).toBe('function')
      expect(typeof global.testPrisma.$disconnect).toBe('function')
    })
  })

  describe('Test Data Validation', () => {
    it('should create users with default values', async () => {
      const user = await createTestUser()

      expect(user.email).toMatch(/@example\.com$/)
      expect(user.name).toBeDefined()
      expect(user.role).toBe('USER')
      expect(user.status).toBe('ACTIVE')
    })

    it('should allow overriding default values', async () => {
      const customData = {
        email: 'custom@test.com',
        name: 'Custom User',
        role: 'ADMIN',
        status: 'PENDING'
      }

      const user = await createTestUser(customData)

      expect(user.email).toBe(customData.email)
      expect(user.name).toBe(customData.name)
      expect(user.role).toBe(customData.role)
      expect(user.status).toBe(customData.status)
    })

    it('should generate unique emails for each user', async () => {
      const user1 = await createTestUser()
      const user2 = await createTestUser()

      expect(user1.email).not.toBe(user2.email)
    })
  })
})
