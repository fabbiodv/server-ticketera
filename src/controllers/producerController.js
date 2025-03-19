const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getProducer = async (req, res) => {
  try {
    const productoras = await prisma.productora.findMany({
      include: { profiles: true },
    });
    res.json(productoras);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener productoras" });
  }
};

const createProducer = async (req, res) => {
  try {
    const { name } = req.body;
    const productora = await prisma.productora.create({
      data: { name },
    });
    res.json(productora);
  } catch (error) {
    res.status(500).json({ error: "Error al crear productora" });
  }
};

module.exports = { getProducer, createProducer };
