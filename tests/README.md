# Testing Suite para Ticketera

Este directorio contiene una suite completa de tests unitarios e integración para la aplicación Ticketera.

## 🚀 Configuración

### Dependencias instaladas:
- **Vitest**: Framework de testing rápido y moderno
- **Supertest**: Para testing de APIs HTTP
- **@vitest/ui**: Interfaz gráfica para ejecutar tests
- **@vitest/coverage-v8**: Reportes de cobertura de código

### Estructura:
```
tests/
├── setup.js                     # Configuración global de tests
├── fixtures/                    # Datos de prueba
│   └── testData.js
├── helpers/                     # Utilidades para tests
│   ├── testHelpers.js           # Funciones auxiliares
│   └── testApp.js               # Aplicación de testing
├── unit/                        # Tests unitarios
│   ├── auth.controller.test.js  # Tests del controlador de auth
│   ├── auth.middleware.test.js  # Tests del middleware de auth
│   └── user.controller.test.js  # Tests del controlador de usuarios
└── integration/                 # Tests de integración
    └── auth.integration.test.js # Tests de flujos completos
```

## 📋 Comandos disponibles

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests en modo watch (recomendado para desarrollo)
npm test -- --watch

# Ejecutar tests con interfaz gráfica
npm run test:ui

# Ejecutar tests una sola vez
npm run test:run

# Generar reporte de cobertura
npm run test:coverage

# Ejecutar solo tests unitarios
npm test -- unit

# Ejecutar solo tests de integración
npm test -- integration

# Ejecutar tests de un archivo específico
npm test -- auth.controller.test.js

# Ejecutar tests con filtro por nombre
npm test -- --grep "should authenticate"
```

## 🧪 Tipos de Tests

### Tests Unitarios
Prueban funciones y métodos individuales de forma aislada:
- **Controladores**: Lógica de negocio de cada endpoint
- **Middlewares**: Autenticación, autorización, validaciones
- **Servicios**: Funciones auxiliares y utilidades

### Tests de Integración
Prueban flujos completos y la interacción entre componentes:
- **Flujos de autenticación completos**
- **Operaciones CRUD en secuencia**
- **Manejo de errores end-to-end**
- **Performance y carga**

## 🔧 Configuración de Base de Datos

Los tests usan la misma base de datos configurada en `DATABASE_URL`. Para testing en paralelo o aislado, considera:

```bash
# Opcional: Configurar base de datos separada para testing
export TEST_DATABASE_URL="postgresql://user:password@localhost:5432/ticketera_test"
```

## 📊 Cobertura de Código

Los tests cubren:
- ✅ **Controladores de autenticación** - 90%+
- ✅ **Middlewares de autorización** - 95%+
- ✅ **Controladores de usuarios** - 85%+
- ⏳ **Controladores de eventos** - En desarrollo
- ⏳ **Controladores de entradas** - En desarrollo
- ⏳ **Controladores de pagos** - En desarrollo

## 🎯 Casos de Uso Cubiertos

### Autenticación
- [x] Registro de usuarios
- [x] Login con contraseña
- [x] Magic link por email
- [x] Refresh de tokens
- [x] Logout
- [x] Actualización de contraseñas
- [x] Validación de tokens

### Gestión de Usuarios
- [x] Crear usuarios
- [x] Listar usuarios con filtros
- [x] Actualizar datos de usuario
- [x] Eliminar usuarios
- [x] Manejo de errores y validaciones

### Middleware de Seguridad
- [x] Autenticación por tokens
- [x] Autorización por roles
- [x] Manejo de tokens expirados
- [x] Autenticación opcional

## 🚨 Mejores Prácticas

### Estructura de Tests
```javascript
describe('Feature Name', () => {
  beforeEach(async () => {
    // Configuración antes de cada test
    await cleanDatabase()
  })

  describe('Happy Path', () => {
    it('should do something successfully', async () => {
      // Arrange
      const testData = createTestData()
      
      // Act
      const response = await request(app)
        .post('/endpoint')
        .send(testData)
      
      // Assert
      expectSuccessResponse(response, 201)
      expect(response.body).toHaveProperty('id')
    })
  })

  describe('Error Cases', () => {
    it('should handle invalid input', async () => {
      const response = await request(app)
        .post('/endpoint')
        .send({}) // Datos inválidos
      
      expectErrorResponse(response, 400)
    })
  })
})
```

### Helpers Útiles
```javascript
// Crear usuario de prueba
const user = await createTestUser({ 
  email: 'test@example.com',
  role: 'ADMIN' 
})

// Request autenticado
const response = await authenticatedRequest(app, user.id)
  .get('/protected-endpoint')

// Limpiar base de datos
await cleanDatabase()

// Verificar respuestas
expectSuccessResponse(response, 200)
expectErrorResponse(response, 401, 'Unauthorized')
```

## 🐛 Debugging Tests

### Ver output detallado:
```bash
npm test -- --verbose
```

### Ejecutar test específico con logs:
```bash
npm test -- --grep "should authenticate" --verbose
```

### Usar interfaz gráfica:
```bash
npm run test:ui
```

## 📈 Próximos Pasos

- [ ] Tests para controladores de eventos
- [ ] Tests para sistema de pagos
- [ ] Tests para integración con MercadoPago
- [ ] Tests de performance con datasets grandes
- [ ] Tests de seguridad y penetración
- [ ] Tests end-to-end con Playwright
- [ ] CI/CD con GitHub Actions

## 🤝 Contribuir

Para agregar nuevos tests:

1. Crear archivo en la carpeta correspondiente (`unit/` o `integration/`)
2. Seguir las convenciones de naming: `feature.test.js`
3. Usar los helpers existentes para consistency
4. Agregar fixtures en `testData.js` si es necesario
5. Documentar casos edge y de error

¡Los tests son fundamentales para mantener la calidad del código! 🧪✨
