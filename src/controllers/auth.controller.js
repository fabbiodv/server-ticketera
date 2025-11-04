import prisma from '../config/database.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { MercadoPagoConfig, Preference, OAuth } from "mercadopago";
import sendEmail from '../config/email.js'
import { magicLinkTemplate } from '../utils/emailTemplates.js'
const mercadopago = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
})

export const login = async (req, res) => {
  try {
    const { email } = req.body

    // Validar que se proporcione email
    if (!email) {
      return res.status(400).json({ error: 'Email es requerido' })
    }

    // Genera un hash aleatorio para el magic link
    const magicLinkToken = await bcrypt.hash(email + Date.now().toString(), 10)
    const tokenExpiry = new Date(Date.now() + 3600000) // 1 hora

    // Actualizamos o creamos el usuario con el token
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        magicLinkToken,
        tokenExpiry
      },
      create: {
        email,
        magicLinkToken,
        tokenExpiry
      }
    })

    const magicLink = `${process.env.BACKEND_URL}/auth/verify?token=${magicLinkToken}`

    // Enviar email con magic link usando Resend
    const emailResult = await sendEmail({
      to: email,
      subject: 'Inicia sesión en Canchita',
      html: magicLinkTemplate(magicLink)
    })

    if (!emailResult.success) {
      return res.status(500).json({ error: 'Error al enviar el email de acceso' });
    }

    res.json({ message: 'Magic link enviado correctamente' });
  } catch (error) {
    console.error(error)
    res.status(400).json({ error: 'Error en el login' })
  }
}

export const verify = async (req, res) => {
  try {
    const { token } = req.query

    const user = await prisma.user.findFirst({
      where: {
        magicLinkToken: token,
        tokenExpiry: {
          gt: new Date()
        }
      }
    })

    if (!user) {
      return res.redirect(`${process.env.LOCAL_FRONTEND_URL}/login?error=invalid_token`)
    }

    // Genera el access token (corta duración)
    const accessToken = jwt.sign(
      {
        userId: user.id,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '15m'
      }
    )

    // Genera el refresh token (larga duración)
    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    )

    // Crear nueva sesión
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
        isValid: true
      }
    })

    // Limpiar el magic link token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        magicLinkToken: null,
        tokenExpiry: null,
        lastLogin: new Date()
      }
    })

    // Configurar cookies
    const cookieConfig = getCookieConfig()

    res.cookie('access_token', accessToken, {
      ...cookieConfig,
      maxAge: 15 * 60 * 1000 // 15 minutos
    })

    res.cookie('refresh_token', refreshToken, {
      ...cookieConfig,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
    })

    // Redirecciona al frontend con un token de éxito temporal
    res.redirect(`${process.env.LOCAL_FRONTEND_URL}/auth/callback?status=success`)

  } catch (error) {
    console.error(error)
    res.redirect(`${process.env.LOCAL_FRONTEND_URL}/login?error=server_error`)
  }
}

export const refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token requerido' })
    }

    // Verificar el refresh token en la base de datos
    const session = await prisma.session.findFirst({
      where: {
        refreshToken,
        isValid: true,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: true
      }
    })

    if (!session) {
      return res.status(401).json({ error: 'Sesión inválida o expirada' })
    }

    // Generar nuevo access token
    const newAccessToken = jwt.sign(
      { userId: session.user.id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    )

    // Actualizar cookie del access token
    const cookieConfig = getCookieConfig()
    res.cookie('access_token', newAccessToken, {
      ...cookieConfig,
      maxAge: 15 * 60 * 1000 // 15 minutos
    })

    res.json({ message: 'Token renovado exitosamente' })
  } catch (error) {
    console.error(error)
    res.status(403).json({ error: 'Error al renovar el token' })
  }
}

export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token

    if (refreshToken) {
      // Invalidar la sesión en la base de datos
      await prisma.session.updateMany({
        where: {
          refreshToken,
          isValid: true
        },
        data: {
          isValid: false
        }
      })
    }

    // Limpiar cookies
    res.clearCookie('access_token')
    res.clearCookie('refresh_token')

    res.json({ message: 'Sesión cerrada exitosamente' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al cerrar sesión' })
  }
}


export const getSession = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        lastName: true,
        phone: true,
        dni: true,
        status: true,
        mpAccessToken: true,
        mpRefreshToken: true,
        createdAt: true,
        lastLogin: true,
      }
    })
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }
    res.json({ user })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener la sesión' })
  }
}

export const connectMercadoPago = async (req, res) => {
  try {
    // Obtenemos la url de autorización
    const url = new OAuth(mercadopago).getAuthorizationURL({
      options: {
        client_id: process.env.MP_MARKETPLACE_CLIENT_ID,
        redirect_uri: process.env.REDIRECT_URI_MP,
      },
    });

    // Devolvemos la url
    res.json({ authUrl: url });
  } catch (error) {
    console.error('Error al conectar MP:', error);
    res.status(500).json({ error: 'Error al iniciar conexión con MercadoPago' });
  }
};

export const mercadoPagoCallback = async (req, res) => {
  try {
    const { code } = req.query;
    // Obtenemos las credenciales del usuario usando el code que obtuvimos de oauth

    const credentials = await new OAuth(mercadopago).create({
      body: {
        client_id: process.env.MP_MARKETPLACE_CLIENT_ID,
        client_secret: process.env.MP_MARKETPLACE_CLIENT_SECRET,
        code,
        redirect_uri: process.env.REDIRECT_URI_MP,
      },
    });

    console.log(credentials)
    await prisma.user.update({
      where: { id: 1 },
      data: {
        mpAccessToken: credentials.access_token,
        mpRefreshToken: credentials.refresh_token,
      }
    })
    res.redirect(`${process.env.LOCAL_FRONTEND_URL}/`);
  } catch (error) {
    console.error('Error en callback MP:', error);
    res.redirect(`${process.env.LOCAL_FRONTEND_URL}/`);
  }
};

// Nuevo método para registro con contraseña
export const register = async (req, res) => {
  try {
    const { email, password, name, lastName, phone, dni } = req.body

    // Validar que se proporcionen email y contraseña
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' })
    }

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return res.status(400).json({ error: 'El usuario ya existe' })
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 10)

    // Crear el usuario
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        lastName,
        phone,
        dni,
        status: 'ACTIVE' // Podemos activar directamente al usuario o mantener PENDING_VERIFICATION
      }
    })

    // Generar tokens
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    )

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    )

    // Crear sesión
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
        isValid: true
      }
    })

    // Configurar cookies
    const cookieConfig = getCookieConfig()
    
    res.cookie('access_token', accessToken, {
      ...cookieConfig,
      maxAge: 15 * 60 * 1000 // 15 minutos
    })

    res.cookie('refresh_token', refreshToken, {
      ...cookieConfig,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
    })

    // Enviar respuesta con tokens
    res.status(201).json({
      message: 'Usuario registrado correctamente',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        lastName: user.lastName,
        status: user.status
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al registrar el usuario' })
  }
}

// Nuevo método para login con contraseña
export const loginWithPassword = async (req, res) => {
  try {
    const { email, password } = req.body

    // Validar que se proporcionen email y contraseña
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' })
    }

    // Buscar al usuario
    const user = await prisma.user.findUnique({
      where: { email }
    })

    // Verificar si el usuario existe y la contraseña es correcta
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    // Actualizar lastLogin
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    })

    // Generar tokens (igual que en el método de verify existente)
    const accessToken = jwt.sign(
      {
        userId: user.id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '50m' }
    )

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    )

    // Crear sesión
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
        isValid: true
      }
    })

    // configurar cookies
    const cookieConfig = getCookieConfig()

    res.cookie('access_token', accessToken, {
      ...cookieConfig,
      maxAge: 15 * 60 * 1000 // 15 minutos
    })

    res.cookie('refresh_token', refreshToken, {
      ...cookieConfig,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
    })

    // Enviar respuesta con tokens
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      tokens: {
        accessToken,
        refreshToken
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error en el login' })
  }
}

export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const userId = req.user.userId // Obtenido del middleware de autenticación

    // Buscar al usuario
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    // Si el usuario ya tiene contraseña, verificar la contraseña actual
    if (user.password) {
      // Si proporcionó una contraseña actual, verificarla
      if (currentPassword) {
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password)
        if (!isPasswordValid) {
          return res.status(401).json({ error: 'Contraseña actual incorrecta' })
        }
      } else {
        // Si ya tiene contraseña pero no proporcionó la actual
        return res.status(400).json({ error: 'Se requiere la contraseña actual' })
      }
    }

    // Validar nueva contraseña
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' })
    }

    // Hashear la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Actualizar la contraseña
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    })

    res.json({ message: 'Contraseña actualizada correctamente' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al actualizar la contraseña' })
  }
}

// Función helper para configuración de cookies
const getCookieConfig = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/'
})