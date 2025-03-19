const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getProfiles = async (req, res) => {
  try {
    const profiles = await prisma.profile.findMany({
      include: { user: true, productora: true },
    });
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener perfiles" });
  }
};

const createProfile = async (req, res) => {
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

module.exports = { getProfiles, createProfile };
