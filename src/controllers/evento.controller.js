import { PrismaClient } from "@prisma/client/extension";


export const getAllEventos = async(req, res ) => {
    try{
        const prisma = new PrismaClient();
        const eventos = await prisma.evento.findMany({
            include: {
                productora: true,
                
            }
        });
        if(!eventos || eventos.length === 0){
            return res.status(404).json({ message: "No se encontraron eventos" });
        }
        res.status(200).json(eventos);
    }catch(error){
        // console.error("Error al obtener eventos:", error);
        res.status(500).json({ error: "Error al obtener eventos" });
    }
}

export const getEventoById = async(req, res) => {
    try{
        const prisma = new PrismaClient();
        const { id } = req.params;
        const evento = await prisma.evento.findUnique({
            where: { id: Number(id) },
            include: {
                productora: true,
                
            }
        });
        if(!evento){
            return res.status(404).json({ message: "Evento no encontrado" });
        }
        res.status(200).json(evento);
    }catch(error){
        // console.error("Error al obtener evento:", error);
        res.status(500).json({ error: "Error al obtener evento" });
    }
}
export const createEvento = async (req, res) => {
    try {
      const { name,date,startTime,endTime,description,location,productoraId} = req.body;
  
      // Validación de campos requeridos
      if (!name || !date || !startTime || !endTime || !location || !productoraId) {
        return res.status(400).json({
          error: "Todos los campos son obligatorios: name, date, startTime, endTime, description, location, productoraId"
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
          productoraId: Number(productoraId),
          ...(tiposEntrada && {
            tipoEntrada: {
              create: tiposEntrada.map(tipo => ({
                nombre: tipo.nombre,
                precio: tipo.precio,
                maximoEntradasPorPersona: tipo.maximoEntradasPorPersona
              }))
            }
          })
        },
        include: {
          productora: true,
          tipoEntrada: true
        }
      });
  
      res.status(201).json({
        message: "Evento creado exitosamente",
        evento
      });
  
    } catch (error) {
      console.error("Error al crear evento:", error);
      res.status(500).json({
        error: "Error al crear el evento",
        details: error.message
      });
    }
  };

export const updateEvento = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, date, startTime, endTime, description, location, capacity, productoraId } = req.body;
  
        // Validación de campos requeridos
        if (!name || !date || !startTime || !endTime || !location || !capacity || !productoraId) {
          return res.status(400).json({
            error: "Todos los campos son obligatorios: name, date, startTime, endTime, description, location, capacity, productoraId"
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
            productoraId: Number(productoraId)
          },
          include: {
            productora: true,
            tipoEntrada: true
          }
        });
  
        res.status(200).json({
          message: "Evento actualizado exitosamente",
          evento
        });
  
      } catch (error) {
        console.error("Error al actualizar evento:", error);
        res.status(500).json({
          error: "Error al actualizar el evento",
          details: error.message
        });
      }
  }
export const deleteEvento = async (req, res) => {
    try {
        const prisma = new PrismaClient();
        const { id } = req.params;
        const evento = await prisma.evento.delete({
            where: { id: Number(id) },
        });
        res.status(200).json({ message: "Evento eliminado exitosamente", evento });
    } catch (error) {
        console.error("Error al eliminar evento:", error);
        res.status(500).json({ error: "Error al eliminar evento" });
    }
}
