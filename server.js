require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");

const app = express();
const port = Number(process.env.PORT || 4242);
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeSecretKey ? Stripe(stripeSecretKey) : null;

const PRICE_MAP_MXN = {
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

const ALLOWED_SHIPPING = new Set([350, 450, 590]);

const couponConfig = {
  RIN10: process.env.STRIPE_COUPON_RIN10 || "",
  AT5: process.env.STRIPE_COUPON_AT5 || ""
};

app.use(cors({ origin: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/create-checkout-session", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        error: "Stripe no esta configurado. Agrega STRIPE_SECRET_KEY en .env y reinicia el servidor."
      });
    }

    const { items, shippingCost, couponCode, origin } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No hay productos en el carrito." });
    }

    const line_items = [];

    for (const rawItem of items) {
      const name = String(rawItem?.name || "").trim();
      const qty = Number(rawItem?.qty || 0);
      const unitAmount = PRICE_MAP_MXN[name];

      if (!name || !unitAmount || !Number.isInteger(qty) || qty < 1 || qty > 20) {
        return res.status(400).json({ error: "Producto invalido en carrito." });
      }

      line_items.push({
        price_data: {
          currency: "mxn",
          product_data: {
            name
          },
          unit_amount: unitAmount * 100
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

    const sessionConfig = {
      mode: "payment",
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
        source: "tusllantas-web"
      }
    };

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

app.listen(port, () => {
  if (!stripe) {
    console.warn("Servidor activo, pero falta STRIPE_SECRET_KEY en .env");
  }
  console.log(`Stripe backend activo en http://localhost:${port}`);
});
