import bcrypt from "bcrypt";
import prisma from "../config/database.js";


export const getUsers = async (req, res) => {
  try {
    const { 
      page, limit, sortBy = 'createdAt', sortOrder = 'desc',
      name, email, status, role,
      ...otherFilters 
    } = req.query;

    const users = await prisma.user.findMany({
      where: {
        ...(name && { name: { contains: name, mode: 'insensitive' } }),
        ...(email && { email: { contains: email, mode: 'insensitive' } }),
        ...(status && { status }),
        ...(role && { 
          profiles: { 
            some: { 
              roles: { 
                some: { role } 
              } 
            } 
          } 
        }),
        
        // Filtros adicionales dinámicos
        ...Object.fromEntries(
          Object.entries(otherFilters)
            .filter(([_, value]) => value)
            .map(([key, value]) => [key, { contains: value, mode: 'insensitive' }])
        )
      },
      select: {
        id: true,
        name: true,
        email: true,
        lastName: true,
        phone: true,
        dni: true,
        status: true,
        createdAt: true,
        lastLogin: true,
        profiles: {
          include: {
            productora: { select: { name: true, code: true } },
            roles: true
          }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      ...(limit && {
        skip: ((parseInt(page) || 1) - 1) * parseInt(limit),
        take: parseInt(limit)
      })
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios: ' + error.message });
  }
};




export const createUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "El correo ya está registrado" });
    }

    // Hashear la contraseña antes de guardarla
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error("Error al crear usuario:", error);
    res.status(500).json({ error: "Error al crear usuario" });
  }
};

export const getUsersByProductoraRole = async (req, res) => {
  try {
    const { role, productoraId } = req.query;

    const users = await prisma.user.findMany({
      where: {
        profiles: {
          some: {
            productoraId: Number(productoraId),
            roles: { some: { role: role } }
          }
        }
      },
      include: { profiles: {include: {roles :true}} },
    });
    res.json(users);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ error: "Error al obtener usuarios", details: error.message });
  }
};

