import express from "express";
import cors from "cors";
import prisma from "./config/database.js";
import productoraRoutes from "./routes/productora.routes.js";
import userRoutes from "./routes/user.routes.js";
import eventoRoutes from "./routes/evento.routes.js";
import tipoEntradaRoutes from "./routes/tipoEntrada.routes.js";
import entradasRoutes from "./routes/entradas.routes.js";
import roleAsigneeRoutes from "./routes/roleAsignee.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import authRoutes from "./routes/auth.routes.js";
import paymentRoutes from "./routes/payment.routes.js"; // Agregar esta línea
import mercadoPagoRoutes from "./routes/mercadoPago.routes.js"; // Agregar esta línea

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ message: "ok" });
});

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/productoras", productoraRoutes);
app.use("/eventos", eventoRoutes);
app.use("/tipoEntrada", tipoEntradaRoutes);
app.use("/entradas", entradasRoutes);
app.use("/roleAsignee", roleAsigneeRoutes);
app.use("/profile", profileRoutes);
app.use("/payment", paymentRoutes); // Agregar esta línea
app.use("/webhooks", mercadoPagoRoutes); // Agregar esta línea

