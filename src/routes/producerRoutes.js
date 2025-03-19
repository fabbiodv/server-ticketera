router.get("/:producerId", authMiddleware, checkProductoraAccess, async (req, res) => {
    const productora = await prisma.productora.findUnique({
      where: { id: parseInt(req.params.productoraId) },
    });
    res.json(productora);
  });