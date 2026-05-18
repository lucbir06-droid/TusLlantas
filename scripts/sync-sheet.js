/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const SHEET_CSV_URL = process.env.SHEET_CSV_URL || "";
const SHEET_LOCAL_CSV = process.env.SHEET_LOCAL_CSV || "";
const OUTPUT_PATH = path.join(__dirname, "..", "data", "products.json");
const IMAGE_BACKUP_DIR = path.join(__dirname, "..", "data", "image-backup");

const BRANCH_COLUMNS = [
  { key: "carr", label: "Carranza" },
  { key: "met", label: "Metepec" },
  { key: "pino", label: "Pino Suarez" },
  { key: "teju", label: "Adolfo Lopez Mateos" }
];

function readArg(name) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  if (!arg) return "";
  return arg.slice(name.length + 1).trim();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      const hasData = row.some((value) => value !== "");
      if (hasData) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    const hasData = row.some((value) => value !== "");
    if (hasData) rows.push(row);
  }

  return rows;
}

function normalizeHeader(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function toNumber(value) {
  if (value == null) return 0;
  const cleaned = String(value).replace(/[^\d.]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? Math.round(num) : 0;
}

function normalizeNameKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildBackupImageMap() {
  const map = new Map();

  try {
    if (!fs.existsSync(IMAGE_BACKUP_DIR)) return map;

    const files = fs
      .readdirSync(IMAGE_BACKUP_DIR)
      .filter((file) => /\.(png|jpe?g|webp|gif)$/i.test(file));

    files.forEach((file) => {
      const baseName = String(file || "").replace(/\.[^.]+$/, "");
      const withoutIndex = baseName.replace(/^\d+-/, "");
      const key = normalizeNameKey(withoutIndex.replace(/-/g, " "));
      if (!key) return;

      map.set(key, `data/image-backup/${file}`);
    });
  } catch {
    return map;
  }

  return map;
}

function resolveBackupImage(name, backupImageMap) {
  const key = normalizeNameKey(name);
  if (!key) return "";

  const directMatch = backupImageMap.get(key);
  if (directMatch) return directMatch;

  for (const [candidateKey, imagePath] of backupImageMap.entries()) {
    if (candidateKey.includes(key) || key.includes(candidateKey)) {
      return imagePath;
    }
  }

  return "";
}

function isLogoImage(url) {
  const value = String(url || "").trim().toLowerCase();
  if (!value) return false;
  return (
    value.includes("logotusllantas") ||
    value.includes("/logos/") ||
    /(^|[^a-z])logo([^a-z]|$)/.test(value)
  );
}

function pickProductImage(recordImage, sheetImageUrl, previousImage, productName, backupImageMap, defaultBackupImage) {
  // Priority 1: Sheet image URL (new column from Google Sheet)
  const rawSheetImageUrl = String(sheetImageUrl || "").trim();
  if (rawSheetImageUrl && !isLogoImage(rawSheetImageUrl)) return rawSheetImageUrl;

  // Priority 2: Record image (old column, if not a logo)
  const rawRecordImage = String(recordImage || "").trim();
  if (rawRecordImage && !isLogoImage(rawRecordImage)) return rawRecordImage;

  // Priority 3: Backup image (image-backup folder match)
  const matchedBackup = resolveBackupImage(productName, backupImageMap);
  if (matchedBackup) return matchedBackup;

  // Priority 4: Previous product image (existing data fallback)
  const rawPreviousImage = String(previousImage || "").trim();
  if (rawPreviousImage && !isLogoImage(rawPreviousImage)) return rawPreviousImage;

  // Priority 5: Default backup image
  return String(defaultBackupImage || "").trim();
}

function readPreviousProductsMap() {
  try {
    if (!fs.existsSync(OUTPUT_PATH)) return new Map();
    const raw = fs.readFileSync(OUTPUT_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Map();

    const map = new Map();
    parsed.forEach((item) => {
      const key = normalizeNameKey(item?.name || "");
      if (key) map.set(key, item);
    });
    return map;
  } catch {
    return new Map();
  }
}

function mapRow(headers, row, previousProductsMap, backupImageMap, defaultBackupImage) {
  const record = {};
  headers.forEach((h, index) => {
    record[h] = (row[index] || "").trim();
  });

  const details = Object.fromEntries(
    Object.entries(record).filter(([key, value]) => {
      if (String(value || "").trim() === "") return false;
      if (BRANCH_COLUMNS.some((branch) => branch.key === key)) return false;
      return true;
    })
  );

  const name =
    record.modelo ||
    record.nombre ||
    record.nombre_producto ||
    record.nombre_del_producto ||
    record.producto ||
    record.descripcion ||
    record.descripcion_producto ||
    record.clave_producto ||
    "";
  const previous = previousProductsMap.get(normalizeNameKey(name));
  const price = toNumber(
    record.precio_mayoreo ||
      record.mayoreo ||
      record.precio_de_mayoreo ||
      record.precio_may ||
      record.wholesale_price ||
      record.precio ||
      record.precio_venta ||
      record.precio_publico ||
      record.costo_publico ||
      record.publico ||
      record.pvp ||
      previous?.price ||
      0
  );
  const totalStock = toNumber(record.existencia_general || record.stock || record.disponibilidad || 0);

  let stockStatus = "disponible";
  if (totalStock <= 0) {
    stockStatus = "agotado";
  } else if (totalStock <= 4) {
    stockStatus = "limitado";
  }

  if (!name || price <= 0) return null;

  const sheetImageUrl = record.imagen_url || record.image_url || "";

  return {
    name,
    price,
    brand: record.marca || previous?.brand || "",
    size: record.medida || record.size || record.rin || previous?.size || "",
    rin: record.rin || previous?.rin || "",
    type: record.tipo || record.categoria || previous?.type || "ciudad",
    stock: stockStatus,
    existencia_general: totalStock,
    totalStock,
    image: pickProductImage(record.imagen, sheetImageUrl, previous?.image, name, backupImageMap, defaultBackupImage),
    details
  };
}

async function syncProductsFromSheet(options = {}) {
  const localFilePath = String(options.localFilePath || SHEET_LOCAL_CSV || "").trim();
  const sheetCsvUrl = String(options.sheetCsvUrl || SHEET_CSV_URL || "").trim();

  let csvText = "";

  if (localFilePath) {
    const resolvedPath = path.isAbsolute(localFilePath)
      ? localFilePath
      : path.join(process.cwd(), localFilePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`No existe el archivo CSV local: ${resolvedPath}`);
    }

    csvText = fs.readFileSync(resolvedPath, "utf8");
    console.log(`CSV local cargado: ${resolvedPath}`);
  } else {
    if (!sheetCsvUrl) {
      throw new Error("Falta SHEET_CSV_URL o --file=RUTA_CSV para sincronizar.");
    }

    const response = await fetch(sheetCsvUrl);
    if (!response.ok) {
      throw new Error(`No se pudo descargar el CSV (${response.status}).`);
    }

    csvText = await response.text();
    console.log("CSV descargado desde Google Sheet.");
  }

  const rows = parseCsv(csvText);

  if (rows.length < 2) {
    throw new Error("El Google Sheet no tiene suficientes filas.");
  }

  const headers = rows[0].map(normalizeHeader);
  const previousProductsMap = readPreviousProductsMap();
  const backupImageMap = buildBackupImageMap();
  const defaultBackupImage = backupImageMap.values().next().value || "";
  const products = rows
    .slice(1)
    .map((row) => mapRow(headers, row, previousProductsMap, backupImageMap, defaultBackupImage))
    .filter(Boolean);

  if (products.length === 0) {
    throw new Error(
      "No se encontraron productos validos. Revisa columnas: modelo y precio_mayoreo."
    );
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(products, null, 2), "utf8");
  console.log(`Productos sincronizados: ${products.length}`);
  console.log(`Archivo generado: ${OUTPUT_PATH}`);

  return {
    source: localFilePath ? "file" : "sheet",
    outputPath: OUTPUT_PATH,
    count: products.length
  };
}

async function main() {
  const argLocalFile = readArg("--file");
  await syncProductsFromSheet({ localFilePath: argLocalFile || SHEET_LOCAL_CSV });
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Error al sincronizar Google Sheet:", error.message);
    process.exit(1);
  });
}

module.exports = {
  syncProductsFromSheet
};
