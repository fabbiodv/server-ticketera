import { PrismaClient } from "@prisma/client";
import prisma from "../config/database.js";

export const getAllEventos = async (req, res) => {
  try {
    const {
      page,
      limit,
      sortBy = "date",
      sortOrder = "asc",
      name,
      location,
      productoraId,
      status,
      dateFrom,
      dateTo,
      capacity,
      minCapacity,
      maxCapacity,
      ...otherFilters
    } = req.query;

    const eventos = await prisma.eventos.findMany({
      where: {
        ...(name && { name: { contains: name, mode: "insensitive" } }),
        ...(location && {
          location: { contains: location, mode: "insensitive" },
        }),
        ...(productoraId && { productoraId: parseInt(productoraId) }),
        ...(status && { status }),
        ...(capacity && { capacity: parseInt(capacity) }),
        ...(minCapacity && { capacity: { gte: parseInt(minCapacity) } }),
        ...(maxCapacity && { capacity: { lte: parseInt(maxCapacity) } }),
        ...((dateFrom || dateTo) && {
          date: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(dateTo) }),
          },
        }),

        // Filtros adicionales dinámicos
        ...Object.fromEntries(
          Object.entries(otherFilters)
            .filter(([_, value]) => value)
            .map(([key, value]) => [
              key,
              { contains: value, mode: "insensitive" },
            ]),
        ),
      },
      include: {
        productora: { select: { name: true, code: true } },
        tipoEntrada: {
          select: {
            id: true,
            nombre: true,
            precio: true,
            estado: true,
            disponible: true,
            totalEntradas: true,
          },
        },
        _count: {
          select: {
            tipoEntrada: true,
            Entrada: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      ...(limit && {
        skip: ((parseInt(page) || 1) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
    });

    res.json(eventos);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error al obtener eventos: " + error.message });
  }
};

export const getEventoById = async (req, res) => {
  try {
    const prisma = new PrismaClient();
    const { id } = req.params;
    const evento = await prisma.eventos.findUnique({
      where: { id: Number(id) },
      include: {
        productora: true,
      },
    });
    if (!evento) {
      return res.status(404).json({ message: "Evento no encontrado" });
    }
    res.status(200).json(evento);
  } catch (error) {
    // console.error("Error al obtener evento:", error);
    res
      .status(500)
      .json({ error: "Error al obtener evento", details: error.message });
  }
};

export const getEventosByProductora = async (req, res) => {
  try {
    const { id } = req.params;
    const eventos = await prisma.eventos.findMany({
      where: { productoraId: Number(id) },
      include: {
        productora: true,
        tipoEntrada: true,
      },
    });
    if (!eventos || eventos.length === 0) {
      return res
        .status(404)
        .json({ message: "No se encontraron eventos para esta productora" });
    }
    res.status(200).json(eventos);
  } catch (error) {
    // console.error("Error al obtener eventos por productora:", error);
    res.status(500).json({
      error: "Error al obtener eventos por productora",
      details: error.message,
    });
  }
};

export const getMyEventos = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      page = 1,
      limit = 10,
      sortBy = "date",
      sortOrder = "asc",
      name,
      location,
      status,
      dateFrom,
      dateTo,
    } = req.query;

    const userProfiles = await prisma.profile.findMany({
      where: {
        userId: userId,
        roles: {
          some: {
            role: {
              in: ["OWNER", "LIDER", "PUBLICA", "SUBPUBLICA", "ORGANIZADOR"],
            },
          },
        },
      },
      include: {
        productora: true,
        roles: true,
      },
    });

    if (userProfiles.length === 0) {
      return res.json({
        eventos: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        message: "No tienes permisos de gestión en ninguna productora",
      });
    }

    const productoraIds = userProfiles.map((profile) => profile.productoraId);

    const whereConditions = {
      productoraId: { in: productoraIds },
      ...(name && { name: { contains: name, mode: "insensitive" } }),
      ...(location && {
        location: { contains: location, mode: "insensitive" },
      }),
      ...(status && { status }),
      ...(dateFrom && { date: { gte: new Date(dateFrom) } }),
      ...(dateTo && { date: { lte: new Date(dateTo) } }),
    };

    const total = await prisma.eventos.count({ where: whereConditions });

    const eventos = await prisma.eventos.findMany({
      where: whereConditions,
      include: {
        productora: {
          select: {
            id: true,
            name: true,
            code: true,
            email: true,
          },
        },
        tipoEntrada: {
          select: {
            id: true,
            nombre: true,
            precio: true,
            totalEntradas: true,
            estado: true,
            disponible: true,
          },
        },
        _count: {
          select: {
            Entrada: true,
          },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    });

    const eventosWithRoles = eventos.map((evento) => {
      const userProfile = userProfiles.find(
        (p) => p.productoraId === evento.productoraId,
      );
      const userRoles = userProfile ? userProfile.roles.map((r) => r.role) : [];

      return {
        ...evento,
        userRoles,
        userProfile: userProfile
          ? {
              id: userProfile.id,
              qrCode: userProfile.qrCode,
            }
          : null,
      };
    });

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      eventos: eventosWithRoles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
      },
      productoras: userProfiles.map((p) => ({
        id: p.productora.id,
        name: p.productora.name,
        code: p.productora.code,
        roles: p.roles.map((r) => r.role),
      })),
    });
  } catch (error) {
    console.error("Error al obtener mis eventos:", error);
    res
      .status(500)
      .json({ error: "Error al obtener eventos", details: error.message });
  }
};

export const createEvento = async (req, res) => {
  try {
    const {
      name,
      date,
      startTime,
      endTime,
      description,
      location,
      capacity,
      productoraId,
      tiposEntrada,
      status = "PROGRAMADO",
    } = req.body;

    // Validación de campos requeridos
    if (
      !name ||
      !date ||
      !startTime ||
      !endTime ||
      !location ||
      !productoraId ||
      !capacity
    ) {
      return res.status(400).json({
        error:
          "Todos los campos son obligatorios: name, date, startTime, endTime, description, location, capacity, productoraId",
      });
    }

    const evento = await prisma.eventos.create({
      data: {
        name,
        date: new Date(date),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        description,
        location,
        capacity: Number(capacity),
        productoraId: Number(productoraId),
        status,
        ...(Array.isArray(tiposEntrada) &&
          tiposEntrada.length > 0 && {
            tipoEntrada: {
              create: tiposEntrada.map((tipo) => ({
                nombre: tipo.nombre,
                precio: tipo.precio,
                totalEntradas: tipo.totalEntradas,
                maximoEntradasPorPersona: tipo.maximoEntradasPorPersona,
              })),
            },
          }),
      },
      include: {
        productora: true,
        tipoEntrada: true,
      },
    });

    res.status(201).json({
      message: "Evento creado exitosamente",
      evento,
    });
  } catch (error) {
    console.error("Error al crear evento:", error);
    res.status(500).json({
      error: "Error al crear el evento",
      details: error.message,
    });
  }
};

export const updateEvento = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      date,
      startTime,
      endTime,
      description,
      location,
      capacity,
      productoraId,
      status,
    } = req.body;

    // Validación de campos requeridos
    if (
      !name ||
      !date ||
      !startTime ||
      !endTime ||
      !location ||
      !capacity ||
      !productoraId
    ) {
      return res.status(400).json({
        error:
          "Todos los campos son obligatorios: name, date, startTime, endTime, description, location, capacity, productoraId",
      });
    }

    const evento = await prisma.eventos.update({
      where: { id: Number(id) },
      data: {
        name,
        date: new Date(date),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        description,
        location,
        capacity: Number(capacity),
        productoraId: Number(productoraId),
        ...(status && { status }),
      },
      include: {
        productora: true,
        tipoEntrada: true,
      },
    });

    res.status(200).json({
      message: "Evento actualizado exitosamente",
      evento,
    });
  } catch (error) {
    console.error("Error al actualizar evento:", error);
    res.status(500).json({
      error: "Error al actualizar el evento",
      details: error.message,
    });
  }
};
export const deleteEvento = async (req, res) => {
  try {
    const { id } = req.params;
    const eventoId = Number(id);

    // Eliminar en cascada: primero las entradas, luego los tipos de entrada, y finalmente el evento
    await prisma.entrada.deleteMany({
      where: { eventoId },
    });

    await prisma.tipoEntrada.deleteMany({
      where: { eventoId },
    });

    const evento = await prisma.eventos.delete({
      where: { id: eventoId },
    });

    res.status(200).json({ message: "Evento eliminado exitosamente", evento });
  } catch (error) {
    console.error("Error al eliminar evento:", error);
    res
      .status(500)
      .json({ error: "Error al eliminar evento", details: error.message });
  }
};
