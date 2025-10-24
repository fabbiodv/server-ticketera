import { beforeAll, afterAll, beforeEach } from 'vitest'
import dotenv from 'dotenv'
import path from 'path'
import { PrismaClient } from '@prisma/client'

// Cargar variables de entorno específicas para testing
dotenv.config({ path: path.join(process.cwd(), '.env.test') })

// Asegurar que NODE_ENV esté en test
process.env.NODE_ENV = 'test'

let testPrismaInstance = null

beforeAll(async () => {
  console.log('Iniciando configuración de tests...')
  
  // Crear instancia de Prisma para tests
  testPrismaInstance = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  })
  
  // Hacer disponible globalmente para los tests
  global.testPrisma = testPrismaInstance
  
  // Conectar a la base de datos
  await testPrismaInstance.$connect()
})

afterAll(async () => {
  if (testPrismaInstance) {
    await testPrismaInstance.$disconnect()
    testPrismaInstance = null
    global.testPrisma = null
  }
  console.log('🧹 Tests finalizados y limpieza completada.')
})




