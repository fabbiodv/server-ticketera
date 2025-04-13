import prisma from "../config/database.js";

export async function crearPerfilesConJerarquia(userId, productoraId, role) {
  const rolesMap = {
    LIDER: ["LIDER", "PUBLICA", "SUBPUBLICA"],
    PUBLICA: ["PUBLICA", "SUBPUBLICA"],
    SUBPUBLICA: ["SUBPUBLICA"]
  };

  const rolesAAsignar = rolesMap[role];

  if (!rolesAAsignar) {
    throw new Error(`Rol no válido: ${role}`);
  }

  for (const r of rolesAAsignar) {
    await prisma.profile.upsert({
      where: {
        userId_productoraId_role: { userId, productoraId, role: r }
      },
      update: {},
      create: {
        userId,
        productoraId,
        role: r
      }
    });
  }

  console.log(`Perfiles asignados correctamente para el rol: ${role}`);
}