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
import checkoutRoutes from "./routes/checkout.routes.js";
import mercadoPagoRoutes from "./routes/mercadoPago.routes.js"; // Agregar esta línea
import vendedorRoutes from "./routes/vendedores.routes.js"; // Nueva línea
import dotenv from "dotenv";
// Cargar variables de entorno del archivo correspondiente
const envFile =
  process.env.NODE_ENV === "test"
    ? ".env.test"
    : process.env.NODE_ENV === "production"
      ? ".env.prod"
      : ".env";
dotenv.config({ path: envFile });

const app = express();
const port = process.env.PORT || 3001;

app.use(
  cors({
    origin: [
      "https://admin.partyckets.com.ar",
      "https://partyckets.com.ar",
      "https://admin-ticketera.vercel.app",
      "http://localhost:3001", // Para desarrollo local del admin
      "http://localhost:3002", // Para desarrollo local del admin
      "http://localhost:3000", // Para desarrollo local del frontend público
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
  }),
);

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
app.use("/payment", paymentRoutes);
app.use("/checkout", checkoutRoutes);
app.use("/webhooks", mercadoPagoRoutes);
app.use("/vendedores", vendedorRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
