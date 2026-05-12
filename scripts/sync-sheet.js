/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const SHEET_CSV_URL = process.env.SHEET_CSV_URL || "";
const SHEET_LOCAL_CSV = process.env.SHEET_LOCAL_CSV || "";
const OUTPUT_PATH = path.join(__dirname, "..", "data", "products.json");

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

function mapRow(headers, row) {
  const record = {};
  headers.forEach((h, index) => {
    record[h] = (row[index] || "").trim();
  });

  const details = Object.fromEntries(
    Object.entries(record).filter(([, value]) => String(value || "").trim() !== "")
  );

  const name =
    record.modelo ||
    record.nombre ||
    record.producto ||
    record.descripcion ||
    record.clave_producto ||
    "";
  const price = toNumber(
    record.precio_mayoreo ||
      record.mayoreo ||
      record.precio_de_mayoreo ||
      record.precio_may ||
      record.wholesale_price
  );
  const branches = Object.fromEntries(
    BRANCH_COLUMNS.map((branch) => [branch.label, toNumber(record[branch.key] || 0)])
  );
  const availableBranches = BRANCH_COLUMNS
    .filter((branch) => toNumber(record[branch.key] || 0) > 0)
    .map((branch) => branch.label);
  const totalStock = toNumber(record.existencia_general || record.stock || record.disponibilidad || 0);

  let stockStatus = "disponible";
  if (totalStock <= 0 || availableBranches.length === 0) {
    stockStatus = "agotado";
  } else if (totalStock <= 4) {
    stockStatus = "limitado";
  }

  if (!name || price <= 0) return null;

  return {
    name,
    price,
    brand: record.marca || "",
    size: record.medida || record.size || record.rin || "",
    rin: record.rin || "",
    type: record.tipo || record.categoria || "ciudad",
    stock: stockStatus,
    totalStock,
    branches,
    availableBranches,
    image: record.imagen || "",
    details
  };
}

async function main() {
  const argLocalFile = readArg("--file");
  const localFilePath = argLocalFile || SHEET_LOCAL_CSV;

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
    if (!SHEET_CSV_URL) {
      throw new Error("Falta SHEET_CSV_URL o --file=RUTA_CSV para sincronizar.");
    }

    const response = await fetch(SHEET_CSV_URL);
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
  const products = rows
    .slice(1)
    .map((row) => mapRow(headers, row))
    .filter(Boolean);

  if (products.length === 0) {
    throw new Error(
      "No se encontraron productos validos. Revisa columnas: modelo y precio_mayoreo."
    );
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(products, null, 2), "utf8");
  console.log(`Productos sincronizados: ${products.length}`);
  console.log(`Archivo generado: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("Error al sincronizar Google Sheet:", error.message);
  process.exit(1);
});
