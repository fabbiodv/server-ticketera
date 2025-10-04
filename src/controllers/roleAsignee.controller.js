import prisma from "../config/database.js";

export const getAllRoleAsignees = async (req, res) => {
  try {
    const {
      page, limit, sortBy = 'createdAt', sortOrder = 'desc',
      profileId, role, userId, productoraId,
      ...otherFilters
    } = req.query;

    const roleAsignees = await prisma.roleAsignee.findMany({
      where: {
        ...(profileId && { profileId: parseInt(profileId) }),
        ...(role && { role }),
        ...(userId && {
          profile: { userId: parseInt(userId) }
        }),
        ...(productoraId && {
          profile: { productoraId: parseInt(productoraId) }
        }),

        // Filtros adicionales dinámicos
        ...Object.fromEntries(
          Object.entries(otherFilters)
            .filter(([_, value]) => value)
            .map(([key, value]) => [key, { contains: value, mode: 'insensitive' }])
        )
      },
      include: {
        profile: {
          include: {
            user: { select: { name: true, email: true } },
            productora: { select: { name: true, code: true } }
          }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      ...(limit && {
        skip: ((parseInt(page) || 1) - 1) * parseInt(limit),
        take: parseInt(limit)
      })
    });

    res.json(roleAsignees);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener asignaciones de roles: ' + error.message });
  }
};

export const getRoleAsigneeById = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeProfile, includeUser } = req.query;

    const roleAsignee = await prisma.roleAsignee.findUnique({
      where: { id: parseInt(id) },
      include: {
        ...(includeProfile === 'true' && {
          profile: {
            include: {
              ...(includeUser === 'true' && {
                user: { select: { name: true, email: true, status: true } }
              }),
              productora: { select: { name: true, code: true } }
            }
          }
        })
      }
    });

    if (!roleAsignee) {
      return res.status(404).json({ error: 'Asignación de rol no encontrada' });
    }

    res.json(roleAsignee);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener asignación de rol: ' + error.message });
  }
};

export const createRoleAsignee = async (req, res) => {
    const { profileId, role } = req.body;

    try {
        const newRoleAsignee = await prisma.roleAsignee.create({
            data: {
                profileId,
                role,
            },
        });
        res.status(201).json(newRoleAsignee);
    } catch (error) {
        console.error("Error al crear el roleAsignee:", error);
        res.status(500).json({ error: "Error al crear el roleAsignee" });
    }
}