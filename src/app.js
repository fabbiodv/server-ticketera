const express = require("express");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// Importar rutas
const userRoutes = require("./routes/userRoutes");
app.use("/users", userRoutes);

module.exports = app;
