import prisma from "../config/database.js";
/**
 * Devuelve el próximo código disponible para una tabla dada.
 * @param {string} modelName - Nombre del modelo Prisma (por ejemplo: "productora")
 * @param {string} field - Campo que representa el código (por defecto: "code")
 * @returns {Promise<string>} - Próximo código disponible (como string)
 */
export default async function getProximoCodigo (modelName, field = "code")  {
  try {
    const model = prisma[modelName];

    if (!model) {
      throw new Error(`Modelo Prisma "${modelName}" no encontrado.`);
    }
    const ultimo = await model.findFirst({
      orderBy: {
        id: "desc",
      },
      select: {
        [field]: true,
      },
    });

    const prefix = modelName.slice(0, 2).toUpperCase();  
    const ultimoCodigo = ultimo?.[field]?.split('-')[1] || "0"; 
    const proximoNumero = (parseInt(ultimoCodigo) + 1).toString();
    return `${prefix}-${proximoNumero}`;

  } catch (error) {
    console.error("Error al obtener el próximo código:", error.message);
    throw error;
  }
};


