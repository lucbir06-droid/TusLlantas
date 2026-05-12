const express = require("express");
const {
  importTireImages,
  importedTireImagesDb
} = require("../services/tireImportService");

const router = express.Router();

router.get("/import-tires", async (req, res) => {
  try {
    const query = String(req.query.q || "llantas para auto").trim();
    const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 50);

    const result = await importTireImages({ query, limit });

    return res.json({
      query,
      requested: limit,
      importedCount: result.imported.length,
      failedCount: result.failed.length,
      products: result.imported,
      failed: result.failed
    });
  } catch (error) {
    return res.status(500).json({
      error: "No se pudieron importar llantas.",
      details: error?.message || "Error desconocido"
    });
  }
});

router.get("/import-tires/history", (_req, res) => {
  return res.json({
    count: importedTireImagesDb.length,
    products: importedTireImagesDb
  });
});

module.exports = router;
