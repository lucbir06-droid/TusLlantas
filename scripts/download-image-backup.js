const fs = require("fs");
const path = require("path");
const axios = require("axios");

const PRODUCTS_PATH = path.join(__dirname, "..", "data", "products.json");
const OUTPUT_DIR = path.join(__dirname, "..", "data", "image-backup");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sanitizeFileName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 100) || "product";
}

function extensionFromResponse(contentType, sourceUrl) {
  const type = String(contentType || "").toLowerCase();
  if (type.includes("image/webp")) return ".webp";
  if (type.includes("image/png")) return ".png";
  if (type.includes("image/jpeg") || type.includes("image/jpg")) return ".jpg";
  if (type.includes("image/avif")) return ".avif";
  if (type.includes("image/gif")) return ".gif";

  const cleanUrl = String(sourceUrl || "").split("?")[0];
  const ext = path.extname(cleanUrl).toLowerCase();
  if ([".webp", ".png", ".jpg", ".jpeg", ".avif", ".gif"].includes(ext)) {
    return ext === ".jpeg" ? ".jpg" : ext;
  }

  return ".img";
}

async function downloadWithRetry(url, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 45000,
        maxRedirects: 5,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
        }
      });
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(500 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

async function run() {
  if (!fs.existsSync(PRODUCTS_PATH)) {
    throw new Error("No se encontro data/products.json");
  }

  const products = JSON.parse(fs.readFileSync(PRODUCTS_PATH, "utf8"));
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const total = products.length;
  let success = 0;
  let skipped = 0;
  let failed = 0;

  const manifest = [];

  for (let i = 0; i < products.length; i += 1) {
    const product = products[i] || {};
    const name = String(product.name || `product-${i + 1}`).trim();
    const imageUrl = String(product.image || "").trim();

    if (!imageUrl) {
      skipped += 1;
      manifest.push({
        index: i + 1,
        name,
        sourceUrl: "",
        file: null,
        status: "skipped",
        reason: "missing-image-url"
      });
      continue;
    }

    try {
      const response = await downloadWithRetry(imageUrl, 2);
      const ext = extensionFromResponse(response.headers["content-type"], imageUrl);
      const base = `${String(i + 1).padStart(4, "0")}-${sanitizeFileName(name)}`;
      const fileName = `${base}${ext}`;
      const filePath = path.join(OUTPUT_DIR, fileName);

      fs.writeFileSync(filePath, Buffer.from(response.data));

      success += 1;
      manifest.push({
        index: i + 1,
        name,
        sourceUrl: imageUrl,
        file: fileName,
        status: "downloaded"
      });
    } catch (error) {
      failed += 1;
      manifest.push({
        index: i + 1,
        name,
        sourceUrl: imageUrl,
        file: null,
        status: "failed",
        error: error?.message || "unknown-error"
      });
    }

    if ((i + 1) % 50 === 0 || i + 1 === total) {
      console.log(`Processed ${i + 1}/${total} | ok=${success} failed=${failed} skipped=${skipped}`);
    }
  }

  fs.writeFileSync(
    MANIFEST_PATH,
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      total,
      downloaded: success,
      failed,
      skipped,
      items: manifest
    }, null, 2)}\n`
  );

  console.log("--- Backup Complete ---");
  console.log(`Output folder: ${OUTPUT_DIR}`);
  console.log(`Manifest: ${MANIFEST_PATH}`);
  console.log(`Downloaded: ${success}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${skipped}`);
}

run().catch((error) => {
  console.error("Backup failed:", error?.message || error);
  process.exit(1);
});
