import prisma from "../config/database.js";

export const getProfiles = async (req, res) => {
  try {
    const profiles = await prisma.profile.findMany({
      include: { user: true, productora: true },
    });
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener perfiles" });
  }
};

export const createProfile = async (req, res) => {
  try {
    const { role, userId, productoraId } = req.body;
    const profile = await prisma.profile.create({
      data: { role, userId, productoraId },
    });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: "Error al crear perfil" });
  }
};

