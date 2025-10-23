import { beforeAll, afterAll, beforeEach } from 'vitest'
import dotenv from 'dotenv'
import path from 'path'

// Cargar variables de entorno específicas para testing
dotenv.config({ path: path.join(process.cwd(), '.env.test') })

// Asegurar que NODE_ENV esté en test
process.env.NODE_ENV = 'test'

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




