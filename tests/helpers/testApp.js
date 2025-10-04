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
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// Routes imports
import userRoutes from '../../src/routes/user.routes.js';
import authRoutes from '../../src/routes/auth.routes.js';
import productoraRoutes from '../../src/routes/productora.routes.js';
import eventoRoutes from '../../src/routes/evento.routes.js';
import tipoEntradaRoutes from '../../src/routes/tipoEntrada.routes.js';
import entradasRoutes from '../../src/routes/entradas.routes.js';
import roleAsigneeRoutes from '../../src/routes/roleAsignee.routes.js';
import profileRoutes from '../../src/routes/profile.routes.js';
import paymentRoutes from '../../src/routes/payment.routes.js';
import mercadoPagoRoutes from '../../src/routes/mercadoPago.routes.js';
import vendedorRoutes from '../../src/routes/vendedores.routes.js';

export function createTestApp() {
  const app = express();

  // CORS configuration para tests
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }));

  // Middlewares
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Routes
  app.use("/users", userRoutes);
  app.use("/auth", authRoutes);
  app.use("/productoras", productoraRoutes);
  app.use("/eventos", eventoRoutes);
  app.use("/tipoEntrada", tipoEntradaRoutes);
  app.use("/entradas", entradasRoutes);
  app.use("/roleAsignee", roleAsigneeRoutes);
  app.use("/profile", profileRoutes);
  app.use("/payment", paymentRoutes);
  app.use("/webhooks", mercadoPagoRoutes);
  app.use("/vendedores", vendedorRoutes);

  // Error handling middleware para tests
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
  });

  return app;
}

export { createTestApp };

export default createTestApp;
