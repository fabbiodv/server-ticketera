import express from "express";
import cors from "cors";
import prisma from "./config/database.js";
import productoraRoutes from "./routes/productora.routes.js";
import userRoutes from "./routes/user.routes.js";

// Inicializar la aplicación Express
const app = express();
const port = process.env.PORT || 3001;

// Middleware para permitir solicitudes CORS
app.use(cors());

// Middleware para parsear cuerpos JSON
app.use(express.json());

// Importar rutas de usuarios
app.use("/users", userRoutes);

app.use("/productoras", productoraRoutes);

// Middleware para manejar errores de Prisma y otras posibles excepciones
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Algo salió mal en el servidor." });
});

// Iniciar el servidor
app.listen(port, async () => {
  try {
    await prisma.$connect()
    console.log('✅ Conexión a la base de datos establecida')
    console.log(`🚀 Servidor corriendo en el puerto ${port}`)
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error)
  }
})

export default app