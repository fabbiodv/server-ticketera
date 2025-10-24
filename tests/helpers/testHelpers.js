import request from 'supertest'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

/**
 * Helper para crear un usuario de prueba
 */
export const createTestUser = async (overrides = {}) => {
  const defaultUser = {
    email: `test${Date.now()}@example.com`,
    name: 'Test User',
    lastName: 'Test LastName',
    phone: '1234567890',
    dni: '12345678',
    status: 'ACTIVE',
    password: await bcrypt.hash('password123', 10),
    ...overrides
  }

  return await global.testPrisma.user.create({
    data: defaultUser
  })
}

/**
 * Helper para crear un token JWT válido para testing
 */
export const createTestToken = (userId, role = 'USER', expiresIn = '1h') => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn }
  )
}

/**
 * Helper para crear cookies de autenticación para testing
 */
export const createAuthCookies = (userId, role = 'USER') => {
  const accessToken = createTestToken(userId, role, '15m')
  const refreshToken = jwt.sign(
    { userId },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  )

  return {
    access_token: accessToken,
    refresh_token: refreshToken
  }
}

/**
 * Helper para hacer requests autenticados
 */
export const authenticatedRequest = (app, userId, role = 'USER') => {
  const cookies = createAuthCookies(userId, role)
  return request(app)
    .set('Cookie', [
      `access_token=${cookies.access_token}`,
      `refresh_token=${cookies.refresh_token}`
    ])
}

/**
 * Helper para limpiar la base de datos entre tests
 */
export const cleanDatabase = async () => {
  if (!global.testPrisma) {
    console.warn('testPrisma no está disponible para limpieza')
    return
  }

  try {
    // Limpiar en orden correcto para evitar problemas de foreign keys
    await global.testPrisma.roleAsignee.deleteMany({})
    await global.testPrisma.payment.deleteMany({})
    await global.testPrisma.entrada.deleteMany({})
    await global.testPrisma.tipoEntrada.deleteMany({})
    await global.testPrisma.eventos.deleteMany({})
    await global.testPrisma.session.deleteMany({})
    await global.testPrisma.profile.deleteMany({})
    await global.testPrisma.user.deleteMany({})
    await global.testPrisma.productora.deleteMany({})
  } catch (error) {
    console.warn('Error durante limpieza de base de datos:', error.message)
  }
}

/**
 * Helper para crear datos de prueba para eventos
 */
export const createTestEvento = async (overrides = {}) => {
  const defaultEvento = {
    nombre: 'Test Event',
    descripcion: 'Test event description',
    fecha: new Date('2024-12-31'),
    ubicacion: 'Test Location',
    capacidad: 100,
    estado: 'ACTIVO',
    ...overrides
  }

  return await global.testPrisma.evento.create({
    data: defaultEvento
  })
}

/**
 * Helper para crear una productora de prueba
 */
export const createTestProductora = async (overrides = {}) => {
  const defaultProductora = {
    nombre: 'Test Productora',
    descripcion: 'Test productora description',
    email: `productora${Date.now()}@example.com`,
    telefono: '1234567890',
    ...overrides
  }

  return await global.testPrisma.productora.create({
    data: defaultProductora
  })
}

/**
 * Helper para assertions comunes
 */
export const expectValidUser = (user) => {
  expect(user).toHaveProperty('id')
  expect(user).toHaveProperty('email')
  expect(user).not.toHaveProperty('password') // La password no debe exponerse
  expect(user).toHaveProperty('createdAt')
}

/**
 * Helper para verificar estructura de respuesta de error
 */
export const expectErrorResponse = (response, statusCode, errorMessage = null) => {
  expect(response.status).toBe(statusCode)
  expect(response.body).toHaveProperty('error')
  if (errorMessage) {
    expect(response.body.error).toBe(errorMessage)
  }
}

/**
 * Helper para verificar estructura de respuesta exitosa
 */
export const expectSuccessResponse = (response, statusCode = 200) => {
  expect(response.status).toBe(statusCode)
  expect(response.body).not.toHaveProperty('error')
}
