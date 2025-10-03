import { beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'

// Variables globales para testing
global.testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
    }
  }
})

// Hooks globales
beforeAll(async () => {
  // Configuración inicial para todos los tests
  console.log('🧪 Iniciando configuración de tests...')
})

afterAll(async () => {
  // Limpieza final
  await global.testPrisma?.$disconnect()
  console.log('🧹 Tests finalizados y limpieza completada.')
})

beforeEach(async () => {
  // Limpieza antes de cada test si es necesario
  // Nota: Esto puede ser costoso, considera usar transacciones para mejor rendimiento
})

// Configuración de variables de entorno para testing
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key'
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret-key'
process.env.BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000'
process.env.LOCAL_FRONTEND_URL = process.env.LOCAL_FRONTEND_URL || 'http://localhost:3001'
