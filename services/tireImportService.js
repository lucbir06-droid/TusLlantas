const axios = require("axios");
const { v2: cloudinary } = require("cloudinary");

const importedTireImagesDb = [];

let cloudinaryConfigured = false;

function toTitleCase(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractBrandFromName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);

  const brandToken = parts.find((token) => /[a-z]/i.test(token) && !/\d/.test(token) && !token.includes("/"));
  return brandToken ? toTitleCase(brandToken) : "Unknown";
}

function configureCloudinary() {
  if (cloudinaryConfigured) return;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary no esta configurado. Agrega CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.");
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret
  });

  cloudinaryConfigured = true;
}

async function fetchTireProducts(options = {}) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error("SerpAPI no esta configurado. Agrega SERPAPI_KEY en tu .env.");
  }

  const query = String(options.query || "llantas para auto").trim();
  const limit = Math.min(Math.max(Number(options.limit || 10), 1), 50);

  const response = await axios.get("https://serpapi.com/search.json", {
    params: {
      engine: "google_shopping",
      q: query,
      api_key: apiKey,
      num: limit
    },
    timeout: 25000
  });

  const shoppingResults = Array.isArray(response.data?.shopping_results)
    ? response.data.shopping_results
    : [];

  return shoppingResults
    .map((item) => {
      const name = String(item?.title || "").trim();
      const sourceImageUrl = String(item?.thumbnail || item?.image || item?.original_image || "").trim();
      const brand = item?.source ? toTitleCase(String(item.source)) : extractBrandFromName(name);

      return {
        name,
        brand,
        sourceImageUrl
      };
    })
    .filter((item) => item.name && item.sourceImageUrl)
    .slice(0, limit);
}

async function uploadImageToCloudinary(imageUrl, options = {}) {
  configureCloudinary();

  if (!imageUrl) {
    throw new Error("La URL de imagen es requerida para subir a Cloudinary.");
  }

  const result = await cloudinary.uploader.upload(imageUrl, {
    folder: "tires",
    fetch_format: "webp",
    quality: "auto",
    ...options
  });

  return result.secure_url;
}

async function importTireImages(options = {}) {
  const tires = await fetchTireProducts(options);
  const imported = [];
  const failed = [];

  for (const tire of tires) {
    try {
      const optimizedImageUrl = await uploadImageToCloudinary(tire.sourceImageUrl);
      const saved = {
        name: tire.name,
        brand: tire.brand,
        image: optimizedImageUrl
      };

      importedTireImagesDb.push({
        ...saved,
        sourceImageUrl: tire.sourceImageUrl,
        importedAt: new Date().toISOString()
      });

      imported.push(saved);
    } catch (error) {
      failed.push({
        name: tire.name,
        brand: tire.brand,
        image: null,
        error: error?.message || "No se pudo subir la imagen a Cloudinary."
      });
    }
  }

  return {
    imported,
    failed
  };
}

module.exports = {
  fetchTireProducts,
  uploadImageToCloudinary,
  importTireImages,
  importedTireImagesDb
};
