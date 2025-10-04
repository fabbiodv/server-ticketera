import jwt from "jsonwebtoken";


/**
 * Middleware para autenticar tokens JWT
 */
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Token de acceso requerido',
        code: 'NO_TOKEN'
      });
    }

    // Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar el usuario en la base de datos
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        profiles: {
          include: {
            productora: {
              select: { id: true, name: true, code: true, status: true }
            },
            roles: true
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({ 
        error: 'Usuario no válido',
        code: 'INVALID_USER'
      });
    }

    // Agregar información del usuario al request
    req.user = {
      userId: user.id,
      email: user.email,
      name: user.name,
      profiles: user.profiles
    };

    next();
  } catch (error) {
    console.error('Error en authenticateToken:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Token inválido',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expirado',
        code: 'EXPIRED_TOKEN'
      });
    }
    
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

export const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({ error: "Acceso denegado, no hay token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Guardamos los datos del usuario en `req.user`
    next();
  } catch (error) {
    res.status(401).json({ error: "Token no válido" });
  }
};

