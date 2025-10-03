import jwt from 'jsonwebtoken'

export const authenticateToken = (req, res, next) => {
  try {
    // Primero intentar obtener el token de las cookies
    let token = req.cookies?.access_token

    // Si no hay token en cookies, intentar con el header Authorization
    if (!token) {
      const authHeader = req.headers['authorization']
      token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN
    }

    if (!token) {
      return res.status(401).json({ error: 'Token de acceso requerido' })
    }

    // Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' })
    }
    return res.status(403).json({ error: 'Token inválido' })
  }
}

export const optionalAuth = (req, res, next) => {
  try {
    let token = req.cookies?.access_token

    if (!token) {
      const authHeader = req.headers['authorization']
      token = authHeader && authHeader.split(' ')[1]
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      req.user = decoded
    }
    
    next()
  } catch (error) {
    // Si hay error con el token opcional, simplemente continuar sin usuario
    next()
  }
}

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autenticación requerida' })
    }

    const userRole = req.user.role
    const allowedRoles = Array.isArray(roles) ? roles : [roles]

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Permisos insuficientes' })
    }

    next()
  }
}
