import jwt from "jsonwebtoken";
import prisma from "../config/database.js";


/**
 * Middleware para autenticar tokens JWT
 */
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    // Si no hay token en el header, buscar en cookies
    if (!token) {
      token = req.cookies?.access_token;
    }

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

/**
 * Middleware para autenticación opcional
 * Permite continuar sin usuario si no hay token válido
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    // Si no hay token en el header, buscar en cookies
    if (!token) {
      token = req.cookies?.access_token;
    }

    if (token) {
      try {
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

        if (user) {
          req.user = {
            userId: user.id,
            email: user.email,
            name: user.name,
            profiles: user.profiles
          };
        }
      } catch (error) {
        // Token inválido, continuar sin usuario
        console.log('Token inválido en optionalAuth, continuando sin usuario');
      }
    }

    next();
  } catch (error) {
    console.error('Error en optionalAuth:', error);
    next();
  }
};

/**
 * Middleware para requerir roles específicos
 */
export const requireRoles = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          error: 'Usuario no autenticado',
          code: 'NO_USER'
        });
      }

      // Obtener todos los roles del usuario
      const userRoles = [];
      req.user.profiles?.forEach(profile => {
        profile.roles?.forEach(role => {
          userRoles.push(role.name);
        });
      });

      // Verificar si el usuario tiene al menos uno de los roles permitidos
      const hasPermission = allowedRoles.some(role => userRoles.includes(role));

      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Permisos insuficientes',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: allowedRoles,
          current: userRoles
        });
      }

      next();
    } catch (error) {
      console.error('Error en requireRoles:', error);
      return res.status(500).json({ 
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

/**
 * Middleware para requerir acceso a una productora específica
 */
export const requireProductoraAccess = () => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          error: 'Usuario no autenticado',
          code: 'NO_USER'
        });
      }

      const productoraId = req.params.productoraId;
      
      if (!productoraId) {
        return res.status(400).json({ 
          error: 'ID de productora requerido',
          code: 'NO_PRODUCTORA_ID'
        });
      }

      // Verificar si el usuario tiene acceso a esta productora
      const hasAccess = req.user.profiles?.some(profile => 
        profile.productora?.id === parseInt(productoraId)
      );

      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Sin acceso a esta productora',
          code: 'NO_PRODUCTORA_ACCESS',
          productoraId
        });
      }

      next();
    } catch (error) {
      console.error('Error en requireProductoraAccess:', error);
      return res.status(500).json({ 
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  };
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

