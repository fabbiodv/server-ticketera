import prisma from "../config/database.js";

export const getAllRoleAsignees = async (req, res) => {
    try {
        const roleAsignees = await prisma.roleAsignee.findMany({
        include: {
            user: true,
            productora: true,
            role: true,
        },
        });
        res.status(200).json(roleAsignees);
    } catch (error) {
        console.error("Error al obtener los roleAsignees:", error);
        res.status(500).json({ error: "Error al obtener los roleAsignees" });
    }
    }
export const getRoleAsigneeById = async (req, res) => {
    try {
        const { id } = req.params;
        const roleAsignee = await prisma.roleAsignee.findUnique({
        where: { id: Number(id) },
        include: {
            user: true,
            productora: true,
            role: true,
        },
        });
        if (!roleAsignee) {
        return res.status(404).json({ message: "RoleAsignee no encontrado" });
        }
        res.status(200).json(roleAsignee);
    } catch (error) {
        console.error("Error al obtener el roleAsignee:", error);
        res.status(500).json({ error: "Error al obtener el roleAsignee" });
    }
}
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