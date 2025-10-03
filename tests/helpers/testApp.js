import express from "express";
import cors from "cors";
import prisma from "../../src/config/database.js";

// Importar todas las rutas
import authRoutes from "../../src/routes/auth.routes.js";
import productoraRoutes from "../../src/routes/productora.routes.js";
import userRoutes from "../../src/routes/user.routes.js";
import eventoRoutes from "../../src/routes/evento.routes.js";
import tipoEntradaRoutes from "../../src/routes/tipoEntrada.routes.js";
import entradasRoutes from "../../src/routes/entradas.routes.js";
import roleAsigneeRoutes from "../../src/routes/roleAsignee.routes.js";
import profileRoutes from "../../src/routes/profile.routes.js";
import paymentRoutes from "../../src/routes/payment.routes.js";
import mercadoPagoRoutes from "../../src/routes/mercadoPago.routes.js";

/**
 * Crea una instancia de la aplicación Express para testing
 * Evita conflictos de puertos y permite testing aislado
 */
export const createTestApp = () => {
  const app = express();

  // Configuración de CORS para testing
  app.use(cors({
    origin: true, // Permitir todos los orígenes en testing
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
  }));

  app.use(express.json());

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({ message: "ok" });
  });

  // Registrar todas las rutas
  app.use("/auth", authRoutes);
  app.use("/users", userRoutes);
  app.use("/productoras", productoraRoutes);
  app.use("/eventos", eventoRoutes);
  app.use("/tipoEntrada", tipoEntradaRoutes);
  app.use("/entradas", entradasRoutes);
  app.use("/roleAsignee", roleAsigneeRoutes);
  app.use("/profile", profileRoutes);
  app.use("/payment", paymentRoutes);
  app.use("/mercadopago", mercadoPagoRoutes);

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Test app error:', err);
    res.status(500).json({ error: "Error interno del servidor en testing" });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint no encontrado' });
  });

  return app;
};

export default createTestApp;
