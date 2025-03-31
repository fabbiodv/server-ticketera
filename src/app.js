const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config(); // Cargar variables de entorno

// Crear una instancia de Prisma Client
const prisma = new PrismaClient();

// Inicializar la aplicación Express
const app = express();

// Middleware para permitir solicitudes CORS
app.use(cors());

// Middleware para parsear cuerpos JSON
app.use(express.json());

// Importar rutas de usuarios
const userRoutes = require("./routes/userRoutes");
app.use("/users", userRoutes);

// Importar rutas de productora
const productoraRoutes = require("./routes/productoraRoutes");
app.use("/productoras", productoraRoutes);

// Middleware para manejar errores de Prisma y otras posibles excepciones
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Algo salió mal en el servidor." });
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000; // Usa el puerto definido en .env o el 3000 por defecto
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app;
