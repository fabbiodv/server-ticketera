const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const checkProductoraAccess = async (req, res, next) => {
  const userId = req.user.id; // Tomado del token JWT
  const { productoraId } = req.params;

  const profile = await prisma.profile.findFirst({
    where: { userId, productoraId: parseInt(productoraId) },
  });

  if (!profile) {
    return res.status(403).json({ error: "No tienes acceso a esta productora" });
  }

  next();
};

module.exports = { checkProductoraAccess };
