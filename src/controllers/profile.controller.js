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
  const { userId, productoraId, role } = req.body;

  try {
    // Validar que la productora exista
    const productora = await prisma.productora.findUnique({
      where: { id: Number(productoraId) }
    });

    if (!productora) {
      
      return res.status(404).json({ error: "La productora con ese ID no existe" });
    }else{
      console.log(productora);
    }

    // Usar transacción para crear perfil y rol si corresponde
    const [newProfile, newRoleAsignee] = await prisma.$transaction(async (tx) => {

      const profile = await tx.profile.create({
        data: {
          userId: Number(userId),
          productoraId: Number(productoraId),
        },
        include: {
          user: true,
          productora: true,
          roles: true
        }
      });

      let roleAsignee = null;
      if (role) {
        roleAsignee = await tx.roleAsignee.create({
          data: {
            profileId: profile.id,
            role: role
          }
        });
      }

      return [profile, roleAsignee];
    });

    res.status(201).json({
      profile: newProfile,
      roleAsignee: newRoleAsignee || null
    });

  } catch (error) {
    console.error("Error al crear perfil:", error);
    res.status(500).json({
      error: "Error al crear perfil",
      details: error.message
    });
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