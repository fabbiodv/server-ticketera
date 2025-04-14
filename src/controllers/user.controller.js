import bcrypt from "bcrypt";
import prisma from "../config/database.js";


export const getUsers = async (req, res) => {
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


