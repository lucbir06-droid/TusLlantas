/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

const PRODUCTS_PATH = path.join(__dirname, "..", "data", "products.json");
const XLSX_PATH = path.join(__dirname, "descripciones_llantas_con_velocidad.xlsx");

const normalizeKey = (value) =>
  String(value || "")
    .replace(/\s*\([^)]*\)/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function buildDetailObject(row) {
  const details = {
    descripcion: String(row["Descripcion Original"] || "").trim(),
    medida: String(row["Medida"] || "").trim(),
    marca: String(row["Marca"] || "").trim(),
    modelo: String(row["Modelo"] || "").trim(),
    tipo: String(row["Tipo"] || "").trim(),
    capas: String(row["Capas"] || "").trim(),
    indice_de_carga: String(row["Índice de Carga"] || "").trim(),
    indice_de_velocidad: String(row["Índice de Velocidad"] || "").trim(),
    acabado: String(row["Acabado"] || "").trim()
  };

  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => String(value || "").trim() !== "")
  );
}

function main() {
  if (!fs.existsSync(PRODUCTS_PATH)) {
    throw new Error(`No existe ${PRODUCTS_PATH}`);
  }
  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error(`No existe ${XLSX_PATH}`);
  }

  const products = JSON.parse(fs.readFileSync(PRODUCTS_PATH, "utf8"));
  const workbook = xlsx.readFile(XLSX_PATH);
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet, { defval: "", raw: false });

  const descriptionMap = new Map();
  rows.forEach((row) => {
    const original = String(row["Descripcion Original"] || "").trim();
    if (!original) return;
    descriptionMap.set(normalizeKey(original), buildDetailObject(row));
  });

  let matched = 0;
  let unmatched = 0;

  const updatedProducts = products.map((product) => {
    const productName = String(product?.name || "").trim();
    const match = descriptionMap.get(normalizeKey(productName));

    if (match) {
      matched += 1;
      return {
        ...product,
        details: match
      };
    }

    unmatched += 1;
    return {
      ...product,
      details: {
        descripcion: productName
      }
    };
  });

  fs.writeFileSync(PRODUCTS_PATH, `${JSON.stringify(updatedProducts, null, 2)}\n`, "utf8");

  console.log(`Productos totales: ${products.length}`);
  console.log(`Descripciones aplicadas desde XLSX: ${matched}`);
  console.log(`Sin match en XLSX (fallback a descripcion): ${unmatched}`);
  console.log(`Archivo actualizado: ${PRODUCTS_PATH}`);
}

main();
