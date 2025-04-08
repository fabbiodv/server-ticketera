import express from "express";
import cors from "cors";
import prisma from "./config/database.js";
import productoraRoutes from "./routes/productora.routes.js";
import userRoutes from "./routes/user.routes.js";
import eventoRoutes from "./routes/evento.routes.js";
import tipoEntradaRoutes from "./routes/tipoEntrada.routes.js";
import entradasRoutes from "./routes/entradas.routes.js";
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

app.use(express.json());

app.use("/users", userRoutes);
app
app.use("/productoras", productoraRoutes);
app.use("/eventos", eventoRoutes);
app.use("/tipoEntrada", tipoEntradaRoutes);
app.use("/entradas", entradasRoutes);
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Algo salió mal en el servidor."+err.message });
});

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