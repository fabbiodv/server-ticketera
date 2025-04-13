import prisma from "../config/database.js";
import { crearPerfilesConJerarquia } from "../utils/profileService.js";
export const getProfiles = async (req, res) => {
  try {
    const profiles = await prisma.profile.findMany({
      include: { user: true, productora: true, roles: true },
    });
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener perfiles" });
  }
};

export const createProfile = async (req, res) => {
  const { userId, productoraId } = req.body;

  try {
    const newProfile = await prisma.profile.create({
      data: {
        userId,
        productoraId,
  
      },
    });
    res.status(201).json(newProfile);
  } catch (error) {
    console.error("Error al crear perfil:", error);
    res.status(500).json({ error: "Error al crear perfil" });
  }
};

export const asignarPerfil = async (req, res) => {
  const { userId, productoraId, role } = req.body;

  try {
    await crearPerfilesConJerarquia(userId, productoraId, role);
    res.status(201).json({ message: "Perfiles asignados correctamente." });
  } catch (error) {
    console.error("Error al asignar perfiles:", error.message);
    res.status(500).json({ error: "No se pudo asignar perfiles." });
  }
};