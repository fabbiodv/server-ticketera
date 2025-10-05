import { beforeAll, afterAll, beforeEach } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key'
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret-key'
process.env.BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000'
process.env.LOCAL_FRONTEND_URL = process.env.LOCAL_FRONTEND_URL || 'http://localhost:3001'

let testPrismaInstance = null

beforeAll(async () => {
  console.log('Iniciando configuración de tests...')
})

afterAll(async () => {
  if (testPrismaInstance) {
    await testPrismaInstance.$disconnect()
    testPrismaInstance = null
  }
  console.log('🧹 Tests finalizados y limpieza completada.')
})




