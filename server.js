require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const tireImportRoutes = require("./routes/tireImportRoutes");

const app = express();
const port = Number(process.env.PORT || 4242);
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeSecretKey ? Stripe(stripeSecretKey) : null;
const USERS_PATH = path.join(__dirname, "data", "users.json");

const DEFAULT_PRICE_MAP_MXN = {
  "Goodyear Wrangler Trailrunner AT 275/60R20": 4799,
  "Euzkadi Radial R/T 10R15": 4094,
  "Hankook RC10 Dynapro XT 275/65R18": 6396,
  "Hankook RF12 Dynapro AT2 275/65R18": 5893,
  "Yusta Conqueror AT 35X12.50R17": 5893,
  "Blackhawk Ridgecrawler A/T 275/60R20": 3432,
  "Hankook RF12 Dynapro AT2 265/70R16": 4965,
  "Hankook RF12 Dynapro AT2 245/75R16": 4595,
  "Hankook RF12 Dynapro AT2 255/70R16": 4975,
  "Euzkadi Overlander AT2 245/70R17": 4727,
  "Goodyear Wrangler Workhorse AT 235/70R16": 3535,
  "Kumho AT52 Road Venture 255/70R16": 3468,
  "Kumho AT51 Road Venture 215/75R14": 2650,
  "Kumho AT52 Road Venture LT 225/75R16": 3849,
  "BFGoodrich Trail-Terrain 235/65R17": 3626,
  "Laufenn LC01 Xfit AT 275/70R18": 4863
};

function loadProductsFromJson() {
  try {
    const productsPath = path.join(__dirname, "data", "products.json");
    if (!fs.existsSync(productsPath)) return [];

    const raw = fs.readFileSync(productsPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => ({
        name: String(item?.name || "").trim(),
        price: Number(item?.price || 0),
        brand: String(item?.brand || "").trim(),
        size: String(item?.size || "").trim(),
        rin: String(item?.rin || "").trim(),
        type: String(item?.type || "").trim(),
        stock: String(item?.stock || "").trim(),
        totalStock: Number(item?.totalStock || 0),
        branches: item?.branches && typeof item.branches === "object" ? item.branches : {},
        availableBranches: Array.isArray(item?.availableBranches) ? item.availableBranches : [],
        image: String(item?.image || "").trim(),
        details: item?.details && typeof item.details === "object" ? item.details : {}
      }))
      .filter((item) => item.name && Number.isFinite(item.price) && item.price > 0);
  } catch {
    return [];
  }
}

function getPriceMapMxn(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return DEFAULT_PRICE_MAP_MXN;
  }

  return Object.fromEntries(products.map((item) => [item.name, Math.round(item.price)]));
}

function getProductsLastUpdated() {
  try {
    const productsPath = path.join(__dirname, "data", "products.json");
    if (!fs.existsSync(productsPath)) return null;
    return fs.statSync(productsPath).mtime.toISOString();
  } catch {
    return null;
  }
}

function ensureUsersStorage() {
  const usersDir = path.dirname(USERS_PATH);
  if (!fs.existsSync(usersDir)) fs.mkdirSync(usersDir, { recursive: true });
  if (!fs.existsSync(USERS_PATH)) fs.writeFileSync(USERS_PATH, "[]\n", "utf8");
}

function readUsers() {
  try {
    ensureUsersStorage();
    const raw = fs.readFileSync(USERS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  ensureUsersStorage();
  fs.writeFileSync(USERS_PATH, `${JSON.stringify(users, null, 2)}\n`, "utf8");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d]/g, "").trim();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const passwordHash = crypto.pbkdf2Sync(String(password), salt, 100000, 64, "sha512").toString("hex");
  return { passwordHash, passwordSalt: salt };
}

function verifyPassword(password, passwordSalt, expectedHash) {
  if (!password || !passwordSalt || !expectedHash) return false;
  const currentHash = crypto.pbkdf2Sync(String(password), String(passwordSalt), 100000, 64, "sha512").toString("hex");
  const expected = String(expectedHash);

  if (currentHash.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(currentHash, "utf8"), Buffer.from(expected, "utf8"));
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt
  };
}

function formatCurrencyMxn(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function runSyncScript() {
  const syncScriptPath = path.join(__dirname, "scripts", "sync-sheet.js");
  const syncProcess = spawn(process.execPath, [syncScriptPath], {
    cwd: __dirname,
    env: process.env,
    stdio: "ignore"
  });

  syncProcess.on("error", () => {
    // Ignorar errores de arranque del proceso de sincronizacion.
  });
}

const autoSyncMs = Number(process.env.AUTO_SYNC_MS || 0);
const hasSyncSource = Boolean(process.env.SHEET_CSV_URL || process.env.SHEET_LOCAL_CSV);

if (hasSyncSource && Number.isFinite(autoSyncMs) && autoSyncMs >= 15000) {
  runSyncScript();
  setInterval(runSyncScript, autoSyncMs);
}

const ALLOWED_SHIPPING = new Set([350, 450, 590]);

const couponConfig = {
  RIN10: process.env.STRIPE_COUPON_RIN10 || "",
  AT5: process.env.STRIPE_COUPON_AT5 || ""
};

const ALLOWED_PICKUP_BRANCHES = new Set(["Carranza", "Metepec", "Pino Suarez", "Adolfo Lopez Mateos"]);

app.use(cors({ origin: true }));
app.use(express.json());
app.use(tireImportRoutes);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/products", (_req, res) => {
  const products = loadProductsFromJson();
  return res.json({
    count: products.length,
    updatedAt: getProductsLastUpdated(),
    products
  });
});

app.post("/api/auth/register", (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email || "");
    const phone = normalizePhone(req.body?.phone || "");
    const password = String(req.body?.password || "");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email && !phone) {
      return res.status(400).json({ error: "Debes registrar correo o telefono." });
    }

    if (email && !emailRegex.test(email)) {
      return res.status(400).json({ error: "Correo invalido." });
    }

    if (phone && (phone.length < 10 || phone.length > 15)) {
      return res.status(400).json({ error: "Telefono invalido. Usa de 10 a 15 digitos." });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "La contrasena debe tener al menos 8 caracteres." });
    }

    const users = readUsers();
    const exists = users.find(
      (user) => (email && normalizeEmail(user.email) === email) || (phone && normalizePhone(user.phone) === phone)
    );

    if (exists) {
      return res.status(409).json({ error: "Ya existe una cuenta con ese correo o telefono. Inicia sesion o usa otros datos." });
    }

    const { passwordHash, passwordSalt } = hashPassword(password);
    const user = {
      id: crypto.randomUUID(),
      name: name || "Cliente tusllantas",
      email: email || "",
      phone: phone || "",
      passwordHash,
      passwordSalt,
      createdAt: new Date().toISOString()
    };

    users.push(user);
    writeUsers(users);

    return res.status(201).json({
      ok: true,
      user: toPublicUser(user)
    });
  } catch {
    return res.status(500).json({ error: "No se pudo crear la cuenta." });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email || "");
    const phone = normalizePhone(req.body?.phone || "");
    const password = String(req.body?.password || "");

    if (!email && !phone) {
      return res.status(400).json({ error: "Ingresa correo o telefono." });
    }

    if (!password) {
      return res.status(400).json({ error: "Ingresa tu contrasena." });
    }

    const users = readUsers();
    const user = users.find(
      (item) => (email && normalizeEmail(item.email) === email) || (phone && normalizePhone(item.phone) === phone)
    );

    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      return res.status(401).json({ error: "Credenciales invalidas." });
    }

    return res.json({
      ok: true,
      user: toPublicUser(user)
    });
  } catch {
    return res.status(500).json({ error: "No se pudo iniciar sesion." });
  }
});

app.post("/api/auth/update-profile", (req, res) => {
  try {
    const userId = String(req.body?.userId || "").trim();
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email || "");
    const phone = normalizePhone(req.body?.phone || "");
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!userId) {
      return res.status(400).json({ error: "Falta el identificador de usuario." });
    }

    if (!email && !phone) {
      return res.status(400).json({ error: "Debes mantener correo o telefono." });
    }

    if (email && !emailRegex.test(email)) {
      return res.status(400).json({ error: "Correo invalido." });
    }

    if (phone && (phone.length < 10 || phone.length > 15)) {
      return res.status(400).json({ error: "Telefono invalido. Usa de 10 a 15 digitos." });
    }

    if (newPassword && newPassword.length < 8) {
      return res.status(400).json({ error: "La nueva contrasena debe tener al menos 8 caracteres." });
    }

    const users = readUsers();
    const userIndex = users.findIndex((item) => String(item?.id || "") === userId);

    if (userIndex < 0) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    const user = users[userIndex];
    const duplicateUser = users.find(
      (item) =>
        String(item?.id || "") !== userId &&
        ((email && normalizeEmail(item?.email) === email) || (phone && normalizePhone(item?.phone) === phone))
    );

    if (duplicateUser) {
      return res.status(409).json({ error: "Ese correo o telefono ya esta registrado en otra cuenta." });
    }

    if (newPassword) {
      const passwordOk = verifyPassword(currentPassword, user.passwordSalt, user.passwordHash);
      if (!passwordOk) {
        return res.status(401).json({ error: "La contrasena actual no es correcta." });
      }
      const { passwordHash, passwordSalt } = hashPassword(newPassword);
      user.passwordHash = passwordHash;
      user.passwordSalt = passwordSalt;
    }

    user.name = name || user.name || "Cliente tusllantas";
    user.email = email;
    user.phone = phone;
    user.updatedAt = new Date().toISOString();

    users[userIndex] = user;
    writeUsers(users);

    return res.json({ ok: true, user: toPublicUser(user) });
  } catch {
    return res.status(500).json({ error: "No se pudo actualizar la cuenta." });
  }
});

app.post("/api/create-checkout-session", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        error: "Stripe no esta configurado. Agrega STRIPE_SECRET_KEY en .env y reinicia el servidor."
      });
    }

    const { items, shippingCost, couponCode, origin, installments, pickupBranch } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No hay productos en el carrito." });
    }

    const installmentCount = Number(installments || 0);
    const hasMonthlyPlan = installmentCount === 3 || installmentCount === 6 || installmentCount === 12;

    const line_items = [];
    const products = loadProductsFromJson();
    const priceMapMxn = getPriceMapMxn(products);

    for (const rawItem of items) {
      const name = String(rawItem?.name || "").trim();
      const qty = Number(rawItem?.qty || 0);
      const unitAmount = priceMapMxn[name] || Number(rawItem?.price || 0);

      if (!name || !unitAmount || !Number.isInteger(qty) || qty < 1 || qty > 20 || unitAmount < 100) {
        return res.status(400).json({ error: "Producto invalido en carrito." });
      }

      const monthlyUnitAmountCents = hasMonthlyPlan ? Math.round((unitAmount * 100) / installmentCount) : 0;
      const monthlyUnitAmount = monthlyUnitAmountCents / 100;
      const displayName = hasMonthlyPlan
        ? `${name} - ${installmentCount} mensualidades de ${formatCurrencyMxn(monthlyUnitAmount)}`
        : name;
      const displayDescription = hasMonthlyPlan
        ? `Monto mensual por llanta en plan ${installmentCount} meses.`
        : undefined;

      line_items.push({
        price_data: {
          currency: "mxn",
          product_data: {
            name: displayName,
            ...(displayDescription ? { description: displayDescription } : {})
          },
          ...(hasMonthlyPlan
            ? {
                recurring: {
                  interval: "month"
                },
                unit_amount: monthlyUnitAmountCents
              }
            : {
                unit_amount: unitAmount * 100
              })
        },
        quantity: qty
      });
    }

    const normalizedShipping = Number(shippingCost || 0);

    if (ALLOWED_SHIPPING.has(normalizedShipping)) {
      line_items.push({
        price_data: {
          currency: "mxn",
          product_data: {
            name: "Envio"
          },
          unit_amount: normalizedShipping * 100
        },
        quantity: 1
      });
    }

    const siteOrigin =
      (typeof origin === "string" && origin.startsWith("http") && origin) ||
      process.env.APP_URL ||
      "http://localhost:5500";

    const discountCoupon = couponConfig[String(couponCode || "").toUpperCase()];

    const normalizedPickupBranch = ALLOWED_PICKUP_BRANCHES.has(String(pickupBranch || ""))
      ? String(pickupBranch)
      : "Sucursal por confirmar";

    const estimatedTotalMxn = line_items.reduce((sum, item) => {
      const unitAmount = Number(item?.price_data?.unit_amount || 0);
      const quantity = Number(item?.quantity || 0);
      return sum + (unitAmount * quantity) / 100;
    }, 0);

    const monthlyEstimate = hasMonthlyPlan ? estimatedTotalMxn : 0;

    const sessionConfig = {
      mode: hasMonthlyPlan ? "subscription" : "payment",
      line_items,
      locale: "es-419",
      success_url: `${siteOrigin}/checkout-exitoso.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteOrigin}/carrito.html?pago=cancelado`,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      shipping_address_collection: {
        allowed_countries: ["MX"]
      },
      metadata: {
        source: "tusllantas-web",
        installments: installments || "pago_unico",
        pickupBranch: normalizedPickupBranch,
        installmentMonthlyEstimate: installmentCount ? String(monthlyEstimate.toFixed(2)) : "0"
      }
    };

    if (hasMonthlyPlan) {
      sessionConfig.subscription_data = {
        metadata: {
          source: "tusllantas-web",
          installments: String(installmentCount),
          pickupBranch: normalizedPickupBranch,
          installmentMonthlyEstimate: String(monthlyEstimate.toFixed(2))
        }
      };
    }

    // Mostrar referencia de mensualidades sin forzar un plan de Stripe no soportado en esta cuenta.
    if (hasMonthlyPlan) {
      sessionConfig.custom_text = {
        submit: {
          message: `Pago estimado: ${installmentCount} mensualidades de ${formatCurrencyMxn(monthlyEstimate)}.`
        }
      };
    }

    if (discountCoupon) {
      sessionConfig.discounts = [{ coupon: discountCoupon }];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe error:", error);

    if (error && error.type === "StripeAuthenticationError") {
      return res.status(500).json({
        error: "La llave de Stripe no es valida. Revisa STRIPE_SECRET_KEY en .env."
      });
    }

    if (error && error.type === "StripePermissionError") {
      return res.status(500).json({
        error: "La cuenta de Stripe no tiene permisos para esta operacion."
      });
    }

    return res.status(500).json({ error: "No se pudo crear la sesion de pago." });
  }
});

app.get("/api/checkout-session-status", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe no esta configurado." });
    }

    const sessionId = String(req.query?.session_id || "").trim();
    if (!sessionId) {
      return res.status(400).json({ error: "Falta session_id." });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"]
    });

    const lineItems = Array.isArray(session?.line_items?.data)
      ? session.line_items.data
          .filter((item) => String(item?.description || "").trim().toLowerCase() !== "envio")
          .map((item) => ({
            name: String(item?.description || "Producto"),
            qty: Number(item?.quantity || 0),
            unitAmount: Number(item?.price?.unit_amount || 0) / 100,
            totalAmount: Number(item?.amount_total || 0) / 100
          }))
      : [];

    return res.json({
      ok: true,
      session: {
        id: session.id,
        mode: String(session.mode || "payment"),
        subscriptionId: session.subscription ? String(session.subscription) : "",
        paymentStatus: session.payment_status,
        amountTotal: Number(session.amount_total || 0) / 100,
        currency: String(session.currency || "mxn").toUpperCase(),
        created: Number(session.created || 0),
        customerEmail: String(session.customer_details?.email || ""),
        pickupBranch: String(session.metadata?.pickupBranch || "Sucursal por confirmar"),
        installments: Number(session.metadata?.installments || 0) || 0,
        installmentMonthlyEstimate: Number(session.metadata?.installmentMonthlyEstimate || 0) || 0,
        lineItems
      }
    });
  } catch {
    return res.status(500).json({ error: "No se pudo validar la sesion de pago." });
  }
});

app.listen(port, () => {
  if (!stripe) {
    console.warn("Servidor activo, pero falta STRIPE_SECRET_KEY en .env");
  }
  console.log(`Stripe backend activo en http://localhost:${port}`);
});
