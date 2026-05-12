const CART_KEY = "tusllantas-cart";
const AUTH_USER_KEY = "tusllantas-auth-user";
const PENDING_CHECKOUT_KEY = "tusllantas-pending-checkout";
const PURCHASES_KEY_PREFIX = "tusllantas-purchases-";
const STRIPE_API_BASE = "http://localhost:4242";
const PRODUCTS_API_URL = `${STRIPE_API_BASE}/api/products`;
const PRODUCTS_LOCAL_URL = "data/products.json";
const PRODUCTS_REFRESH_MS = 30000;
const LOGIN_PAGE = "iniciar-sesion.html";
const SIGNUP_PAGE = "crear-cuenta.html";
const BRANCH_LABELS = [
  "Carranza",
  "Metepec",
  "Pino Suarez",
  "Adolfo Lopez Mateos"
]

const escapeHtml = (text) =>
  String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeSlug = (text, fallback = "") =>
  String(text || fallback)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || fallback;

const normalizeNameKey = (text) =>
  String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildProductUrl = (name) => `producto.html?name=${encodeURIComponent(String(name || "").trim())}`;

const formatDetailKey = (key) =>
  String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const readCart = () => {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
};

const readAuthUser = () => {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const saveAuthUser = (user) => {
  if (!user || typeof user !== "object") return;
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
};

const clearAuthUser = () => {
  localStorage.removeItem(AUTH_USER_KEY);
};

const purchasesKeyForUser = (userId) => `${PURCHASES_KEY_PREFIX}${String(userId || "").trim()}`;

const readPurchases = (userId) => {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(purchasesKeyForUser(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const savePurchases = (userId, purchases) => {
  if (!userId) return;
  localStorage.setItem(purchasesKeyForUser(userId), JSON.stringify(Array.isArray(purchases) ? purchases : []));
};

const savePendingCheckout = (payload) => {
  localStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(payload || {}));
};

const readPendingCheckout = () => {
  try {
    const raw = localStorage.getItem(PENDING_CHECKOUT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const clearPendingCheckout = () => {
  localStorage.removeItem(PENDING_CHECKOUT_KEY);
};

const getSafeReturnTo = () => {
  const params = new URLSearchParams(window.location.search);
  const rawValue = String(params.get("returnTo") || "").trim();
  if (!rawValue) return "";
  if (rawValue.startsWith("http://") || rawValue.startsWith("https://") || rawValue.startsWith("//")) return "";

  const normalized = rawValue.startsWith("/") ? rawValue.slice(1) : rawValue;
  if (!normalized.endsWith(".html") && !normalized.includes(".html?")) return "";
  return normalized;
};

const redirectAfterAuthIfNeeded = () => {
  const returnTo = getSafeReturnTo();
  window.location.href = returnTo || "index.html";
};

const buildAuthPageUrl = (page) => {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const currentSearch = window.location.search || "";
  const returnTo = `${currentPage}${currentSearch}`;
  return `${page}?returnTo=${encodeURIComponent(returnTo)}`;
};

const authDisplayName = (user) => {
  const name = String(user?.name || "").trim();
  if (name) return name;
  const email = String(user?.email || "").trim();
  if (email) return email;
  const phone = String(user?.phone || "").trim();
  if (phone) return phone;
  return "Mi perfil";
};

const ensureAuthLink = (actions) => {
  const existing = actions.querySelector("[data-auth-link]");
  if (existing) return existing;

  const fallback = Array.from(actions.querySelectorAll("a.icon-btn")).find(
    (link) => [LOGIN_PAGE, SIGNUP_PAGE, "cuenta.html"].includes(String(link.getAttribute("href") || "").toLowerCase())
  );
  if (fallback) {
    fallback.setAttribute("data-auth-link", "true");
    return fallback;
  }

  const created = document.createElement("a");
  created.className = "icon-btn";
  created.href = LOGIN_PAGE;
  created.setAttribute("data-auth-link", "true");
  created.textContent = "Entrar";

  actions.appendChild(created);

  return created;
};

const closeProfileMenus = () => {
  document.querySelectorAll(".profile-menu.open").forEach((menu) => menu.classList.remove("open"));
};

const renderHeaderAuth = () => {
  const user = readAuthUser();
  document.querySelectorAll(".header-actions").forEach((actions) => {
    const authLink = ensureAuthLink(actions);
    const existingMenu = actions.querySelector(".profile-menu");
    const existingGuest = actions.querySelector(".guest-auth-actions");
    if (existingMenu) existingMenu.remove();
    if (existingGuest) existingGuest.remove();

    const cartButton = actions.querySelector(".cart-btn");

    if (!user) {
      authLink.style.display = "none";
      authLink.textContent = "Entrar";
      authLink.href = LOGIN_PAGE;

      const guestActions = document.createElement("div");
      guestActions.className = "guest-auth-actions";
      guestActions.innerHTML = `
        <a href="${escapeHtml(buildAuthPageUrl(LOGIN_PAGE))}" class="icon-btn guest-login-btn" aria-label="Iniciar sesion">Iniciar sesion</a>
        <a href="${escapeHtml(buildAuthPageUrl(SIGNUP_PAGE))}" class="icon-btn guest-signup-btn" aria-label="Crear cuenta">Crear cuenta</a>
      `;

      if (cartButton) {
        actions.insertBefore(guestActions, cartButton);
      } else {
        actions.appendChild(guestActions);
      }

      return;
    }

    authLink.style.display = "none";

    const menu = document.createElement("div");
    menu.className = "profile-menu";
    menu.innerHTML = `
      <button type="button" class="icon-btn profile-toggle" data-profile-toggle="true" aria-expanded="false" aria-label="Mi perfil" title="Mi perfil">
        <svg viewBox="0 0 24 24" class="profile-icon" aria-hidden="true" focusable="false">
          <circle cx="12" cy="8" r="4"></circle>
          <path d="M4 20c1.8-3.7 5-5.5 8-5.5s6.2 1.8 8 5.5"></path>
        </svg>
      </button>
      <div class="profile-dropdown" role="menu" aria-label="Menu de perfil">
        <p class="profile-name">${escapeHtml(authDisplayName(user))}</p>
        <a href="compras.html" role="menuitem">Mis compras</a>
        <a href="detalles-cuenta.html" role="menuitem">Detalles de cuenta</a>
        <button type="button" class="profile-logout" data-auth-logout="true" role="menuitem">Cerrar sesion</button>
      </div>
    `;

    actions.appendChild(menu);
  });
};

const initAuthUi = () => {
  if (document.body.dataset.authUiBound === "true") return;
  document.body.dataset.authUiBound = "true";

  document.addEventListener("click", (event) => {
    const target = event.target;
    const toggle = target.closest("[data-profile-toggle]");
    const logout = target.closest("[data-auth-logout]");

    if (toggle) {
      const menu = toggle.closest(".profile-menu");
      const willOpen = !menu.classList.contains("open");
      closeProfileMenus();
      menu.classList.toggle("open", willOpen);
      toggle.setAttribute("aria-expanded", String(willOpen));
      return;
    }

    if (logout) {
      clearAuthUser();
      closeProfileMenus();
      renderHeaderAuth();
      const feedback = document.getElementById("loginFeedback") || document.getElementById("registerFeedback");
      if (feedback) {
        feedback.textContent = "Sesion cerrada correctamente.";
        feedback.classList.remove("error");
        feedback.classList.add("ok");
      }
      return;
    }

    if (!target.closest(".profile-menu")) {
      closeProfileMenus();
    }
  });
};

const saveCart = (cart) => {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
};

const formatPrice = (value) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0
  }).format(value);

const DEFAULT_PRODUCT_IMAGE = "https://images.unsplash.com/photo-1575797123336-58f4e7a6ce91?auto=format&fit=crop&w=900&q=80";

const normalizeImageUrl = (url) => {
  const value = String(url || "").trim();
  if (!value) return DEFAULT_PRODUCT_IMAGE;

  // Keep all tire photos framed consistently when hosted in Cloudinary.
  if (value.includes("res.cloudinary.com") && value.includes("/upload/")) {
    return value.replace("/upload/", "/upload/f_auto,q_auto,c_pad,b_white,w_900,h_900/");
  }

  return value;
};

const KNOWN_BRANDS = [
  "bfgoodrich",
  "royal black",
  "ling long",
  "i-link",
  "momo tires",
  "gt radial",
  "joyroad",
  "nexen",
  "champiro",
  "kapsen",
  "mileking",
  "compasal",
  "hifly",
  "sunwide",
  "westlake",
  "blackhawk",
  "fronway",
  "triangle",
  "sumitomo",
  "hankook",
  "goodyear",
  "michelin",
  "continental",
  "cooper",
  "federal",
  "firestone",
  "general",
  "kumho",
  "laufenn",
  "maxxis",
  "pirelli",
  "yokohama",
  "yusta",
  "atlas",
  "annaite",
  "duraturn",
  "euzkadi",
  "altenzo",
  "momo"
];

const inferBrandFromProduct = (product) => {
  const explicitBrand = String(product?.brand || "").trim();
  if (explicitBrand) return normalizeSlug(explicitBrand, "general");

  const sourceText = String(product?.name || product?.details?.descripcion || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]+/g, " ");

  const matchedBrand = KNOWN_BRANDS
    .sort((left, right) => right.length - left.length)
    .find((brand) => sourceText.includes(brand));

  return normalizeSlug(matchedBrand || sourceText.split(/\s+/).find(Boolean) || "general", "general");
};

const inferSizeFromProduct = (product) => {
  const explicitSize = String(product?.size || "").trim();
  if (explicitSize) return normalizeSlug(explicitSize, "sin-medida");

  const sourceText = String(product?.name || product?.details?.descripcion || "").toUpperCase();
  const sizeMatch = sourceText.match(/((?:P|LT)?\d{3}\/\d{2,3}R\d{2}|\d{2,3}\/\d{2,3}R\d{2}|\d{2}X\d{1,2}(?:\.\d{1,2})?R\d{2}|\d{2,3}R\d{2})/);

  return normalizeSlug(sizeMatch?.[1] || "sin-medida", "sin-medida");
};

const inferRinFromProduct = (product) => {
  const explicitRin = String(product?.rin || "").trim();
  if (explicitRin) return normalizeSlug(explicitRin, "0");

  const sourceText = String(product?.name || product?.details?.descripcion || "").toUpperCase();
  const rinMatch = sourceText.match(/R(\d{2})\b/);

  return normalizeSlug(rinMatch?.[1] || "0", "0");
};

const parseCatalogSearchCriteria = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    brand: normalizeNameKey(String(params.get("q") || "")),
    width: String(params.get("ancho") || "").trim(),
    profile: String(params.get("perfil") || "").trim(),
    rin: String(params.get("rin") || "").trim()
  };
};

const extractSizeParts = (product) => {
  const rawSize = String(product?.size || "").trim() || String(product?.details?.medida || "").trim();
  const normalized = rawSize.toUpperCase();
  const match = normalized.match(/(\d{3})\/(\d{2,3})R(\d{2})/);
  if (!match) {
    return {
      width: "",
      profile: "",
      rin: String(product?.rin || "").trim()
    };
  }

  return {
    width: match[1],
    profile: match[2],
    rin: match[3]
  };
};

const matchesCatalogSearchCriteria = (product, criteria) => {
  const productBrandKey = normalizeNameKey(product?.brand || inferBrandFromProduct(product));
  const productNameKey = normalizeNameKey(product?.name || "");
  const sizeParts = extractSizeParts(product);

  const brandOk = !criteria.brand || productBrandKey.includes(criteria.brand) || productNameKey.includes(criteria.brand);
  const widthOk = !criteria.width || sizeParts.width === criteria.width;
  const profileOk = !criteria.profile || sizeParts.profile === criteria.profile;
  const rinOk = !criteria.rin || sizeParts.rin === criteria.rin || String(product?.rin || "").trim() === criteria.rin;

  return brandOk && widthOk && profileOk && rinOk;
};

const inferTypeFromProduct = (product) => {
  const explicitType = normalizeSlug(product?.type || "", "");
  if (explicitType && explicitType !== "ciudad") return explicitType;

  const sourceText = String(product?.name || product?.details?.descripcion || "").toLowerCase();

  if (/\b(runflat|rft|zp)\b/.test(sourceText)) return "runflat";
  if (/\b(mud terrain|mud-terrain|m\/t| mt )\b/.test(` ${sourceText} `)) return "mud-terrain";
  if (/\b(all terrain|all-terrain|a\/t|at2|at3|trailrunner at|wrangler|overlander|ridgecrawler|dynapro at|road venture at|conqueror at|rugged terrain)\b/.test(sourceText)) return "all-terrain";
  if (/\b(6pr|8pr|10pr|12pr|14pr|16pr|de carga|carga|cargo|lt\b)\b/.test(sourceText)) return "carga";
  if (/\b(oferta|promo|promocion|descuento)\b/.test(sourceText)) return "ofertas";
  if (/\b(highway|touring|sport|asphalt|street|ht|h\/t|carretera)\b/.test(` ${sourceText} `)) return "carretera";

  return "ciudad";
};

const getStockState = (totalStock) => {
  if (totalStock <= 0) return "low";
  if (totalStock <= 3) return "warn";
  return "in";
};

const getStockText = (product) => {
  const availableBranches = Array.isArray(product?.availableBranches)
    ? product.availableBranches.filter((value) => String(value || "").trim() !== "")
    : [];
  const totalStock = Number(product?.totalStock || availableBranches.length || 0);

  if (totalStock <= 0) return "Agotado";
  if (totalStock <= 3) {
    return `Ultimas ${totalStock} piezas${availableBranches.length ? ` en: ${availableBranches.join(" | ")}` : ""}`;
  }

  return availableBranches.length
    ? `Disponible en: ${availableBranches.join(" | ")}`
    : "Disponible";
};

const fetchProducts = async () => {
  try {
    const response = await fetch(PRODUCTS_API_URL);
    if (response.ok) {
      const data = await response.json();
      const products = Array.isArray(data?.products) ? data.products : [];
      if (products.length) return products;
    }
  } catch {
    // Ignorar y usar fallback local.
  }

  try {
    const localResponse = await fetch(PRODUCTS_LOCAL_URL);
    if (!localResponse.ok) return [];
    const localData = await localResponse.json();
    return Array.isArray(localData) ? localData : [];
  } catch {
    return [];
  }
};

const syncCatalogProductLinks = () => {
  document.querySelectorAll("#catalogGrid .product-card").forEach((card) => {
    const button = card.querySelector(".add-to-cart");
    const nameFromButton = String(button?.dataset?.name || "").trim();
    const anchor = card.querySelector("h3 a");
    if (!anchor) return;

    const name = nameFromButton || anchor.textContent.trim();
    if (!name) return;

    anchor.href = buildProductUrl(name);
  });
};

const initProductDetailPage = async () => {
  const productPage = document.querySelector(".product-page");
  if (!productPage) return;

  const params = new URLSearchParams(window.location.search);
  const requestedName = String(params.get("name") || "").trim();
  if (!requestedName) return;

  const products = await fetchProducts();
  if (!products.length) return;

  const requestedKey = normalizeNameKey(requestedName);
  const product = products.find((item) => normalizeNameKey(item?.name) === requestedKey);
  if (!product) return;

  const productName = String(product.name || requestedName).trim();
  const productPrice = Number(product.price || 0);
  const productImage = normalizeImageUrl(product.image);
  const productType = inferTypeFromProduct(product).replace(/-/g, " ");
  const productSize = String(product.size || "").trim() || String(product.details?.medida || "").trim() || "Medida no especificada";
  const totalStock = Number(product.totalStock || 0);
  const stockState = getStockState(totalStock);
  const stockLabel = getStockText(product);
  const branchText = Array.isArray(product.availableBranches) && product.availableBranches.length
    ? product.availableBranches.join(" | ")
    : "Sucursal por confirmar";

  document.title = `${productName} | tusllantas`;

  const breadcrumbCurrent = document.querySelector(".breadcrumbs span:last-child");
  if (breadcrumbCurrent) breadcrumbCurrent.textContent = productName;

  const eyebrow = document.querySelector(".product-summary .eyebrow");
  if (eyebrow) eyebrow.textContent = `${productSize} - ${productType}`;

  const title = document.querySelector(".product-summary h1");
  if (title) title.textContent = productName;

  const priceNode = document.querySelector(".product-summary .price");
  if (priceNode) priceNode.textContent = `${formatPrice(productPrice)} MXN`;

  const stockNode = document.querySelector(".product-summary .stock");
  if (stockNode) {
    stockNode.classList.remove("in", "warn", "low");
    stockNode.classList.add(stockState);
    stockNode.textContent = stockLabel;
  }

  const points = document.querySelector(".summary-points");
  if (points) {
    const pointsHtml = [
      `<li>Disponibilidad total: ${totalStock} pieza(s).</li>`,
      `<li>Sucursales: ${escapeHtml(branchText)}.</li>`,
      `<li>Tipo: ${escapeHtml(productType)}.</li>`
    ];
    points.innerHTML = pointsHtml.join("");
  }

  const addButton = document.querySelector(".product-summary .add-to-cart");
  if (addButton) {
    addButton.dataset.name = productName;
    addButton.dataset.price = String(productPrice);
  }

  const mainImage = document.getElementById("mainImage");
  if (mainImage) {
    mainImage.src = productImage;
    mainImage.alt = productName;
  }

  const thumbs = document.querySelector(".thumbs");
  if (thumbs) {
    thumbs.innerHTML = `<button class="thumb active" data-src="${escapeHtml(productImage)}">Vista principal</button>`;
  }

  const deliveryNote = document.querySelector(".delivery-note");
  if (deliveryNote) {
    deliveryNote.textContent = "Pronto habilitaremos envios nacionales. Por ahora, te atendemos y entregamos en sucursal.";
  }

  const waNode = document.querySelector(".cta-group .btn-ghost");
  if (waNode) {
    waNode.href = `https://wa.me/527229145544?text=${encodeURIComponent(`Hola, me interesa la llanta ${productName}`)}`;
  }

  const specsBody = document.querySelector(".product-specs tbody");
  if (specsBody) {
    const privateDetailKeys = new Set(["proveedor", "mayoreo", "buenfin2025", "costopublico"]);
    const entries = Object.entries(product.details || {}).filter(([key, value]) => {
      const normalizedKey = String(key || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
      return key && String(value || "").trim() !== "" && !privateDetailKeys.has(normalizedKey);
    });
    const fallbackRows = [
      ["Medida", productSize],
      ["Tipo", productType],
      ["Stock total", String(totalStock)],
      ["Sucursales", branchText]
    ];

    const rows = entries.length
      ? entries.map(([key, value]) => `<tr><th>${escapeHtml(formatDetailKey(key))}</th><td>${escapeHtml(value)}</td></tr>`)
      : fallbackRows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`);

    specsBody.innerHTML = rows.join("");
  }

  const relatedGrid = document.querySelector(".related-products .product-grid");
  if (relatedGrid) {
    const currentNameKey = normalizeNameKey(productName);
    const related = products
      .filter((item) => normalizeNameKey(item?.name) !== currentNameKey)
      .filter((item) => inferTypeFromProduct(item) === inferTypeFromProduct(product))
      .slice(0, 3);

    if (related.length) {
      relatedGrid.innerHTML = related
        .map((item) => {
          const name = String(item?.name || "").trim();
          const image = normalizeImageUrl(item?.image);
          const price = Number(item?.price || 0);
          const size = String(item?.size || "").trim() || String(item?.details?.medida || "").trim() || "N/A";
          const type = inferTypeFromProduct(item).replace(/-/g, " ");

          return `
            <article class="product-card">
              <img loading="lazy" src="${escapeHtml(image)}" alt="${escapeHtml(name)}" />
              <div class="product-content">
                <p class="meta">${escapeHtml(size)}</p>
                <h3><a href="${escapeHtml(buildProductUrl(name))}">${escapeHtml(name)}</a></h3>
                <p class="meta">${escapeHtml(type)}</p>
                <p class="price">${formatPrice(price)}</p>
                <button class="btn btn-primary add-to-cart" data-name="${escapeHtml(name)}" data-price="${price}">Agregar al carrito</button>
              </div>
            </article>
          `;
        })
        .join("");
    }
  }

  bindAddButtons();
  initGallery();
};

const updateCartCount = () => {
  const cart = readCart();
  const total = cart.reduce((sum, item) => sum + item.qty, 0);
  document.querySelectorAll("#cartCount").forEach((node) => {
    node.textContent = String(total);
  });
};

const addToCart = (name, price) => {
  const cart = readCart();
  const exists = cart.find((item) => item.name === name);

  if (exists) {
    exists.qty += 1;
  } else {
    cart.push({ name, price, qty: 1 });
  }

  saveCart(cart);
};

const bindAddButtons = () => {
  document.querySelectorAll(".add-to-cart").forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.dataset.name;
      const price = Number(button.dataset.price || 0);
      addToCart(name, price);
      button.textContent = "Agregado";
      setTimeout(() => {
        button.textContent = "Agregar al carrito";
      }, 900);
    });
  });
};

const initMenuToggle = () => {
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("mainNav");

  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    nav.classList.toggle("show");
  });
};

const initGallery = () => {
  const mainImage = document.getElementById("mainImage");
  if (!mainImage) return;

  mainImage.src = normalizeImageUrl(mainImage.src);

  document.querySelectorAll(".thumb").forEach((thumb) => {
    thumb.addEventListener("click", () => {
      const src = thumb.dataset.src;
      mainImage.src = normalizeImageUrl(src);

      document.querySelectorAll(".thumb").forEach((item) => item.classList.remove("active"));
      thumb.classList.add("active");
    });
  });
};

const selectedValues = (selector) =>
  Array.from(document.querySelectorAll(selector))
    .filter((node) => node.checked)
    .map((node) => node.value.toLowerCase());

const initCatalogFilters = () => {
  const catalogGrid = document.getElementById("catalogGrid");
  const resultsCount = document.getElementById("resultsCount");
  const priceRange = document.getElementById("priceRange");
  const priceValue = document.getElementById("priceValue");

  if (!catalogGrid || !priceRange || !priceValue || !resultsCount) return;

  const applyFilters = () => {
    const brands = selectedValues(".filter-brand");
    const sizes = selectedValues(".filter-size");
    const rins = selectedValues(".filter-rin");
    const types = selectedValues(".filter-type");
    const maxPrice = Number(priceRange.value);
    const stock = (document.querySelector(".filter-stock:checked") || {}).value || "all";

    priceValue.textContent = `Hasta ${formatPrice(maxPrice)}`;

    let shown = 0;
    document.querySelectorAll(".catalog-item").forEach((item) => {
      const itemBrand = item.dataset.brand.toLowerCase();
      const itemSize = item.dataset.size.toLowerCase();
      const itemRin = item.dataset.rin.toLowerCase();
      const itemType = item.dataset.type.toLowerCase();
      const itemPrice = Number(item.dataset.price);
      const itemStock = item.dataset.stock.toLowerCase();

      const brandOk = brands.length === 0 || brands.includes(itemBrand);
      const sizeOk = sizes.length === 0 || sizes.includes(itemSize);
      const rinOk = rins.length === 0 || rins.includes(itemRin);
      const typeOk = types.length === 0 || types.includes(itemType);
      const priceOk = itemPrice <= maxPrice;
      const stockOk = stock === "all" || itemStock === stock;

      const visible = brandOk && sizeOk && rinOk && typeOk && priceOk && stockOk;
      item.style.display = visible ? "grid" : "none";
      if (visible) shown += 1;
    });

    resultsCount.textContent = `Mostrando ${shown} resultados`;
  };

  const triggerNodes = document.querySelectorAll(
    ".filter-brand, .filter-size, .filter-rin, .filter-type, .filter-stock, #priceRange"
  );

  triggerNodes.forEach((node) => {
    node.addEventListener("input", applyFilters);
    node.addEventListener("change", applyFilters);
  });

  const loadCatalogFromApi = async () => {
    try {
      const products = await fetchProducts();
      if (!products.length) return;

      const searchCriteria = parseCatalogSearchCriteria();
      const productsBySmartSearch = products.filter((item) => matchesCatalogSearchCriteria(item, searchCriteria));
      const hasSmartSearch = Boolean(searchCriteria.brand || searchCriteria.width || searchCriteria.profile || searchCriteria.rin);
      const renderProducts = hasSmartSearch ? productsBySmartSearch : products;

      if (searchCriteria.rin) {
        document.querySelectorAll(".filter-rin").forEach((node) => {
          node.checked = String(node.value || "").trim() === searchCriteria.rin;
        });
      }

      if (searchCriteria.brand) {
        document.querySelectorAll(".filter-brand").forEach((node) => {
          const value = normalizeNameKey(String(node.value || ""));
          node.checked = value && (value.includes(searchCriteria.brand) || searchCriteria.brand.includes(value));
        });
      }

      const maxApiPrice = renderProducts.reduce((max, item) => {
        const price = Number(item?.price || 0);
        return price > max ? price : max;
      }, Number(priceRange.value || 12000));

      priceRange.max = String(Math.max(1200, Math.ceil(maxApiPrice / 100) * 100));
      priceRange.value = priceRange.max;

      catalogGrid.innerHTML = renderProducts
        .map((product) => {
          const name = String(product?.name || "").trim();
          const price = Number(product?.price || 0);
          if (!name || !price) return "";

          const brand = inferBrandFromProduct(product);
          const size = inferSizeFromProduct(product);
          const rin = inferRinFromProduct(product);
          const type = inferTypeFromProduct(product);
          const image = normalizeImageUrl(product?.image);
          const availableBranches = Array.isArray(product?.availableBranches)
            ? product.availableBranches.filter((value) => String(value || "").trim() !== "")
            : [];
          const totalStock = Number(product?.totalStock || availableBranches.length || 0);
          const stockState = totalStock <= 0 ? "low" : totalStock <= 3 ? "warn" : "in";
          const stockLabel = totalStock <= 0
            ? "Agotado"
            : totalStock <= 3
              ? `Ultimas 3 piezas en: ${availableBranches.join(" | ") || "sucursal no especificada"}`
              : `Disponible en: ${availableBranches.join(" | ") || "sucursal no especificada"}`;

          return `
            <article class="product-card catalog-item" data-brand="${escapeHtml(brand)}" data-size="${escapeHtml(size)}" data-rin="${escapeHtml(rin)}" data-type="${escapeHtml(type)}" data-price="${price}" data-stock="${escapeHtml(stockState === "warn" ? "limitado" : stockState === "low" ? "agotado" : "disponible")}">
              <img loading="lazy" src="${escapeHtml(image)}" alt="${escapeHtml(name)}" />
              <div class="product-content">
                <h3><a href="${escapeHtml(buildProductUrl(name))}">${escapeHtml(name)}</a></h3>
                <p class="price">${formatPrice(price)}</p>
                <p class="stock ${stockState}">${stockLabel}</p>
                <button class="btn btn-primary add-to-cart" data-name="${escapeHtml(name)}" data-price="${price}">Agregar al carrito</button>
              </div>
            </article>
          `;
        })
        .filter(Boolean)
        .join("");

      bindAddButtons();
      syncCatalogProductLinks();
    } catch {
      // Si falla la API, se mantiene el catalogo estatico actual.
    }

    applyFilters();
  };

  loadCatalogFromApi();
  setInterval(loadCatalogFromApi, PRODUCTS_REFRESH_MS);
};

const initFeaturedProducts = async () => {
  const grid = document.getElementById("homeFeaturedGrid");
  if (!grid) return;

  try {
    const products = await fetchProducts();
    if (!products.length) return;

    const validImageProducts = products
      .filter((item) => Number(item?.price || 0) > 0)
      .filter((item) => String(item?.image || "").includes("res.cloudinary.com"));

    const featured = [];
    const usedNames = new Set();

    const addProduct = (product) => {
      if (!product) return;
      const nameKey = normalizeNameKey(product?.name || "");
      if (!nameKey || usedNames.has(nameKey)) return;
      usedNames.add(nameKey);
      featured.push(product);
    };

    // Keep the first slot as the strongest in-stock option.
    addProduct(
      [...validImageProducts].sort(
        (left, right) => Number(right?.totalStock || 0) - Number(left?.totalStock || 0)
      )[0]
    );

    // Curate slot 2 and 3 with products that normally have better photo quality.
    const slot2Candidates = [
      "Goodyear Wrangler Trailrunner AT 275/60R20",
      "Hankook RC10 Dynapro XT 275/65R18",
      "BFGoodrich Trail-Terrain 235/65R17"
    ];
    const slot3Candidates = [
      "Hankook RF12 Dynapro AT2 275/65R18",
      "Goodyear Wrangler Workhorse AT 235/70R16",
      "Kumho AT52 Road Venture 255/70R16"
    ];

    const pickByNames = (candidates) =>
      candidates
        .map((name) => validImageProducts.find((item) => normalizeNameKey(item?.name) === normalizeNameKey(name)))
        .find(Boolean);

    addProduct(pickByNames(slot2Candidates));
    addProduct(pickByNames(slot3Candidates));

    if (featured.length < 3) {
      validImageProducts
        .sort((left, right) => Number(right?.totalStock || 0) - Number(left?.totalStock || 0))
        .forEach((item) => {
          if (featured.length < 3) addProduct(item);
        });
    }

    if (!featured.length) return;

    grid.innerHTML = featured
      .map((product) => {
        const name = String(product?.name || "").trim();
        const price = Number(product?.price || 0);
        const image = normalizeImageUrl(product?.image);
        const size = String(product?.size || "").trim() || String(product?.details?.medida || "").trim() || "Medida no especificada";
        const type = inferTypeFromProduct(product).replace(/-/g, " ");
        const stockState = getStockState(Number(product?.totalStock || 0));
        const stockLabel = getStockText(product);

        return `
          <article class="product-card" data-price="${price}" data-brand="${escapeHtml(inferBrandFromProduct(product))}" data-rin="${escapeHtml(inferRinFromProduct(product))}" data-type="${escapeHtml(inferTypeFromProduct(product))}" data-stock="${escapeHtml(stockState === "warn" ? "limitado" : stockState === "low" ? "agotado" : "disponible")}">
            <img loading="lazy" src="${escapeHtml(image)}" alt="${escapeHtml(name)}" />
            <div class="product-content">
              <p class="meta">${escapeHtml(size)}</p>
              <h3><a href="${escapeHtml(buildProductUrl(name))}">${escapeHtml(name)}</a></h3>
              <p class="meta">Uso: ${escapeHtml(type)}</p>
              <p class="price">${formatPrice(price)}</p>
              <p class="stock ${stockState}">${escapeHtml(stockLabel)}</p>
              <button class="btn btn-primary add-to-cart" data-name="${escapeHtml(name)}" data-price="${price}">Agregar al carrito</button>
            </div>
          </article>
        `;
      })
      .join("");

    bindAddButtons();
  } catch {
    // Mantener tarjetas estaticas si falla la carga de inventario.
  }
};

const renderCart = () => {
  const container = document.getElementById("cartItemsContainer");
  if (!container) return;

  const subtotalValue = document.getElementById("subtotalValue");
  const subtotalLabel = document.getElementById("subtotalLabel");
  const discountValue = document.getElementById("discountValue");
  const discountLabel = document.getElementById("discountLabel");
  const totalValue = document.getElementById("totalValue");
  const totalLabel = document.getElementById("totalLabel");
  const installmentsSelect = document.getElementById("installments");
  const couponCode = document.getElementById("couponCode");
  const pickupBranch = document.getElementById("pickupBranch");
  const applyCoupon = document.getElementById("applyCoupon");
  const checkoutButton = document.getElementById("checkoutButton");
  const cartImageMap = new Map();

  let discount = 0;

  const buildCartImageMap = async () => {
    try {
      const products = await fetchProducts();
      products.forEach((product) => {
        const key = normalizeNameKey(product?.name || "");
        if (!key) return;
        cartImageMap.set(key, normalizeImageUrl(product?.image));
      });
    } catch {
      // Ignore image map errors and keep default image fallback.
    }
  };

  const calculate = () => {
    const cart = readCart();
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const total = Math.max(0, subtotal - discount);
    const installmentCount = Number(installmentsSelect?.value || 0);

    if (installmentCount === 3 || installmentCount === 6 || installmentCount === 12) {
      const subtotalMonthly = subtotal / installmentCount;
      const discountMonthly = discount / installmentCount;
      const totalMonthly = total / installmentCount;

      if (subtotalLabel) subtotalLabel.textContent = "Subtotal / mes";
      if (discountLabel) discountLabel.textContent = "Descuento / mes";
      if (totalLabel) totalLabel.textContent = "Total / mes";

      subtotalValue.textContent = formatPrice(subtotalMonthly);
      discountValue.textContent = `-${formatPrice(discountMonthly)}`;
      totalValue.textContent = formatPrice(totalMonthly);
    } else {
      if (subtotalLabel) subtotalLabel.textContent = "Subtotal";
      if (discountLabel) discountLabel.textContent = "Descuento";
      if (totalLabel) totalLabel.textContent = "Total";

      subtotalValue.textContent = formatPrice(subtotal);
      discountValue.textContent = `-${formatPrice(discount)}`;
      totalValue.textContent = formatPrice(total);
    }
  };

  const draw = () => {
    const cart = readCart();

    if (!cart.length) {
      container.innerHTML = `
        <div class="cart-empty">
          <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>
          <h3>Tu carrito esta vacio</h3>
          <p>Aun no has agregado ninguna llanta. Explora el catalogo y encuentra la medida que necesitas.</p>
          <a href="catalogo.html" class="btn btn-primary">Ver catalogo</a>
        </div>
      `;
      calculate();
      return;
    }

    container.innerHTML = cart
      .map(
        (item, index) => {
          const image = cartImageMap.get(normalizeNameKey(item?.name || "")) || DEFAULT_PRODUCT_IMAGE;
          return `
          <article class=\"cart-item\">
            <img class=\"cart-item-image\" loading=\"lazy\" src=\"${escapeHtml(image)}\" alt=\"${escapeHtml(item.name)}\" />
            <div>
              <h3>${item.name}</h3>
              <p class=\"meta\">Precio unitario: ${formatPrice(item.price)}</p>
            </div>
            <div class=\"qty-control\" data-index=\"${index}\">
              <button type=\"button\" class=\"qty-minus\">-</button>
              <span>${item.qty}</span>
              <button type=\"button\" class=\"qty-plus\">+</button>
            </div>
            <button type=\"button\" class=\"remove-btn\" data-index=\"${index}\">Quitar</button>
          </article>
        `;
        }
      )
      .join("");

    container.querySelectorAll(".qty-plus").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = Number(btn.parentElement.dataset.index);
        const cartData = readCart();
        cartData[index].qty += 1;
        saveCart(cartData);
        draw();
      });
    });

    container.querySelectorAll(".qty-minus").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = Number(btn.parentElement.dataset.index);
        const cartData = readCart();
        cartData[index].qty = Math.max(1, cartData[index].qty - 1);
        saveCart(cartData);
        draw();
      });
    });

    container.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = Number(btn.dataset.index);
        const cartData = readCart();
        cartData.splice(index, 1);
        saveCart(cartData);
        draw();
      });
    });

    calculate();
  };

  applyCoupon.addEventListener("click", () => {
    const code = (couponCode.value || "").trim().toUpperCase();

    if (code === "RIN10") {
      discount = 250;
    } else if (code === "AT5") {
      discount = 500;
    } else {
      discount = 0;
    }

    calculate();
  });

  if (installmentsSelect) {
    installmentsSelect.addEventListener("change", calculate);
  }

  if (checkoutButton) {
    checkoutButton.addEventListener("click", async () => {
      const activeUser = readAuthUser();
      if (!activeUser?.id) {
        window.location.href = `${LOGIN_PAGE}?returnTo=${encodeURIComponent("carrito.html")}`;
        return;
      }

      const items = readCart();

      if (!items.length) {
        const note = document.getElementById("cartEmptyNote");
        if (note) { note.hidden = false; setTimeout(() => { note.hidden = true; }, 3500); }
        return;
      }

      checkoutButton.disabled = true;
      checkoutButton.textContent = "Conectando con Stripe...";

      try {
        const selectedPickupBranch = String(pickupBranch?.value || "Carranza").trim();
        savePendingCheckout({
          createdAt: new Date().toISOString(),
          pickupBranch: selectedPickupBranch,
          installments: Number(document.getElementById("installments").value || 0),
          items: items.map((item) => ({
            name: String(item?.name || ""),
            qty: Number(item?.qty || 0),
            price: Number(item?.price || 0)
          }))
        });

        const response = await fetch(`${STRIPE_API_BASE}/api/create-checkout-session`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            items,
            shippingCost: 0,
            couponCode: (couponCode.value || "").trim().toUpperCase(),
            installments: Number(document.getElementById("installments").value || 0),
            pickupBranch: selectedPickupBranch,
            origin: window.location.origin
          })
        });

        const raw = await response.text();
        let data = {};

        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          data = {};
        }

        if (!response.ok || !data.url) {
          throw new Error(
            data.error ||
              "No se pudo iniciar el pago. Verifica que el backend de Stripe este corriendo en http://localhost:4242."
          );
        }

        window.location.href = data.url;
      } catch (error) {
        alert(error.message || "Error al iniciar Stripe Checkout");
      } finally {
        checkoutButton.disabled = false;
        checkoutButton.textContent = "Pagar con Stripe";
      }
    });
  }

  draw();
  buildCartImageMap().then(draw);
};

const formatDateTimeMx = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Fecha no disponible";
  return parsed.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

const initCheckoutSuccessPage = async () => {
  const root = document.getElementById("checkoutSuccessRoot");
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const sessionId = String(params.get("session_id") || "").trim();
  const statusNode = document.getElementById("checkoutSuccessStatus");
  const detailsNode = document.getElementById("checkoutSuccessDetails");
  const activeUser = readAuthUser();

  if (!sessionId) {
    if (statusNode) statusNode.textContent = "No encontramos el identificador de la compra.";
    return;
  }

  if (!activeUser?.id) {
    if (statusNode) statusNode.textContent = "Inicia sesion para guardar esta compra en tu historial.";
    return;
  }

  try {
    const response = await fetch(`${STRIPE_API_BASE}/api/checkout-session-status?session_id=${encodeURIComponent(sessionId)}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.session) {
      throw new Error(data?.error || "No se pudo validar el pago.");
    }

    const session = data.session;
    if (session.paymentStatus !== "paid") {
      if (statusNode) statusNode.textContent = "El pago aun no esta confirmado. La compra no se agrego al historial.";
      return;
    }

    const purchases = readPurchases(activeUser.id);
    const exists = purchases.some((purchase) => String(purchase?.sessionId || "") === session.id);

    if (!exists) {
      const pending = readPendingCheckout();
      const purchase = {
        sessionId: session.id,
        createdAt: session.created ? new Date(session.created * 1000).toISOString() : new Date().toISOString(),
        paymentStatus: session.paymentStatus,
        mode: String(session.mode || "payment"),
        subscriptionId: String(session.subscriptionId || ""),
        installments: Number(session.installments || pending?.installments || 0),
        monthlyEstimate: Number(session.installmentMonthlyEstimate || 0),
        pickupBranch: String(session.pickupBranch || pending?.pickupBranch || "Sucursal por confirmar"),
        total: Number(session.amountTotal || 0),
        currency: String(session.currency || "MXN"),
        items: Array.isArray(session.lineItems)
          ? session.lineItems.map((item) => ({
              name: String(item?.name || "Producto"),
              qty: Number(item?.qty || 0),
              unitAmount: Number(item?.unitAmount || 0),
              totalAmount: Number(item?.totalAmount || 0)
            }))
          : []
      };

      purchases.unshift(purchase);
      savePurchases(activeUser.id, purchases);
    }

    localStorage.removeItem(CART_KEY);
    clearPendingCheckout();
    updateCartCount();

    if (statusNode) statusNode.textContent = "Pago confirmado. Tu compra ya aparece en Mis compras.";
    if (detailsNode) {
      detailsNode.textContent = `Sucursal: ${session.pickupBranch || "Sucursal por confirmar"} | Folio: ${session.id}`;
    }
  } catch (error) {
    if (statusNode) statusNode.textContent = error?.message || "No se pudo validar el pago.";
  }
};

const initPurchasesPage = async () => {
  const list = document.getElementById("purchasesList");
  if (!list) return;

  const purchaseImageMap = new Map();
  try {
    const products = await fetchProducts();
    products.forEach((product) => {
      const key = normalizeNameKey(product?.name || "");
      if (!key) return;
      purchaseImageMap.set(key, normalizeImageUrl(product?.image));
    });
  } catch {
    // Keep fallback image for purchase items if inventory is unavailable.
  }

  const activeUser = readAuthUser();
  if (!activeUser?.id) {
    list.innerHTML = `
      <article class="purchase-empty">
        <h3>Inicia sesion para ver tus compras</h3>
        <p>Tu historial se muestra unicamente para tu cuenta.</p>
        <a class="btn btn-primary" href="${LOGIN_PAGE}">Ir a iniciar sesion</a>
      </article>
    `;
    return;
  }

  const purchases = readPurchases(activeUser.id);
  if (!purchases.length) {
    list.innerHTML = `
      <article class="purchase-empty">
        <h3>Aun no tienes compras confirmadas</h3>
        <p>Las compras aparecen aqui solo despues de que Stripe confirma el pago.</p>
      </article>
    `;
    return;
  }

  list.innerHTML = purchases
    .map((purchase) => {
      const items = Array.isArray(purchase?.items) ? purchase.items : [];
      const itemsHtml = items.length
        ? items
            .map(
              (item) => {
                const image = purchaseImageMap.get(normalizeNameKey(item?.name || "")) || DEFAULT_PRODUCT_IMAGE;
                return `<li>
                  <div class="purchase-item-row">
                    <img class="purchase-item-image" loading="lazy" src="${escapeHtml(image)}" alt="${escapeHtml(item.name)}" />
                    <div class="purchase-item-text">
                      <strong>${escapeHtml(item.name)}</strong>
                      <span>${Number(item.qty || 0)} x ${formatPrice(Number(item.unitAmount || 0))}</span>
                    </div>
                  </div>
                </li>`;
              }
            )
            .join("")
        : "<li>Sin productos disponibles.</li>";

      return `
        <article class="purchase-card">
          <div class="purchase-head">
            <p class="purchase-folio">Folio: ${escapeHtml(String(purchase.sessionId || ""))}</p>
            <span class="purchase-badge">Pago confirmado</span>
          </div>
          <p class="purchase-meta">Fecha: ${escapeHtml(formatDateTimeMx(purchase.createdAt))}</p>
          <p class="purchase-meta">Sucursal de recoleccion: ${escapeHtml(String(purchase.pickupBranch || "Sucursal por confirmar"))}</p>
          ${Number(purchase.installments || 0) > 0
            ? `<p class="purchase-meta">Cobro mensual: ${formatPrice(Number(purchase.total || 0))} ${escapeHtml(String(purchase.currency || "MXN"))} | Plazo: ${Number(purchase.installments || 0)} meses</p>
               <p class="purchase-meta">Total estimado del plan: ${formatPrice((Number(purchase.monthlyEstimate || 0) || Number(purchase.total || 0)) * Number(purchase.installments || 0))} ${escapeHtml(String(purchase.currency || "MXN"))}</p>`
            : `<p class="purchase-meta">Total: ${formatPrice(Number(purchase.total || 0))} ${escapeHtml(String(purchase.currency || "MXN"))}</p>`}
          <ul class="purchase-items">${itemsHtml}</ul>
        </article>
      `;
    })
    .join("");
};

const initRegisterForm = () => {
  const form = document.getElementById("registerForm");
  if (!form) return;

  const nameInput = document.getElementById("registerName");
  const emailInput = document.getElementById("registerEmail");
  const phoneInput = document.getElementById("registerPhone");
  const passwordInput = document.getElementById("registerPassword");
  const submitButton = document.getElementById("registerSubmit");
  const feedback = document.getElementById("registerFeedback");

  const setFeedback = (message, isError = false) => {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.toggle("error", Boolean(isError));
    feedback.classList.toggle("ok", !isError && Boolean(message));
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      name: String(nameInput?.value || "").trim(),
      email: String(emailInput?.value || "").trim(),
      phone: String(phoneInput?.value || "").trim(),
      password: String(passwordInput?.value || "")
    };

    if (!payload.email && !payload.phone) {
      setFeedback("Ingresa correo o telefono para crear tu cuenta.", true);
      return;
    }

    if (payload.password.length < 8) {
      setFeedback("La contrasena debe tener al menos 8 caracteres.", true);
      return;
    }

    setFeedback("");
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Creando cuenta...";
    }

    try {
      const response = await fetch(`${STRIPE_API_BASE}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo crear la cuenta.");
      }

      if (data?.user) {
        saveAuthUser(data.user);
        renderHeaderAuth();
        redirectAfterAuthIfNeeded();
      }

      form.reset();
      setFeedback("Cuenta creada correctamente. Sesion iniciada.");
    } catch (error) {
      const rawMessage = String(error?.message || "").toLowerCase();
      const connectionError = rawMessage.includes("failed to fetch") || rawMessage.includes("networkerror");
      if (connectionError) {
        setFeedback("No se pudo conectar al servidor. Verifica que el backend este activo en http://localhost:4242.", true);
      } else {
        setFeedback(error?.message || "Error al crear la cuenta.", true);
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Crear cuenta";
      }
    }
  });
};

const initLoginForm = () => {
  const form = document.getElementById("loginForm");
  if (!form) return;

  const identifierInput = document.getElementById("loginIdentifier");
  const passwordInput = document.getElementById("loginPassword");
  const submitButton = document.getElementById("loginSubmit");
  const feedback = document.getElementById("loginFeedback");

  const setFeedback = (message, isError = false) => {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.toggle("error", Boolean(isError));
    feedback.classList.toggle("ok", !isError && Boolean(message));
  };

  const activeUser = readAuthUser();
  if (activeUser) {
    setFeedback(`Ya tienes sesion iniciada como ${authDisplayName(activeUser)}.`);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const rawIdentifier = String(identifierInput?.value || "").trim();
    const looksLikeEmail = rawIdentifier.includes("@");

    const payload = {
      email: looksLikeEmail ? rawIdentifier : "",
      phone: looksLikeEmail ? "" : rawIdentifier,
      password: String(passwordInput?.value || "")
    };

    if (!payload.email && !payload.phone) {
      setFeedback("Ingresa correo o telefono.", true);
      return;
    }

    if (!payload.password) {
      setFeedback("Ingresa tu contrasena.", true);
      return;
    }

    setFeedback("");
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Iniciando...";
    }

    try {
      const response = await fetch(`${STRIPE_API_BASE}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo iniciar sesion.");
      }

      if (data?.user) {
        saveAuthUser(data.user);
        renderHeaderAuth();
        redirectAfterAuthIfNeeded();
      }

      form.reset();
      setFeedback("Sesion iniciada correctamente.");
    } catch (error) {
      const rawMessage = String(error?.message || "").toLowerCase();
      const connectionError = rawMessage.includes("failed to fetch") || rawMessage.includes("networkerror");
      if (connectionError) {
        setFeedback("No se pudo conectar al servidor. Verifica que el backend este activo en http://localhost:4242.", true);
      } else {
        setFeedback(error?.message || "Error al iniciar sesion.", true);
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Iniciar sesion";
      }
    }
  });
};

const initAccountDetailsPage = () => {
  const form = document.getElementById("accountDetailsForm");
  if (!form) return;

  const activeUser = readAuthUser();
  if (!activeUser?.id) {
    window.location.href = LOGIN_PAGE;
    return;
  }

  const nameInput = document.getElementById("accountName");
  const emailInput = document.getElementById("accountEmail");
  const phoneInput = document.getElementById("accountPhone");
  const currentPasswordInput = document.getElementById("accountCurrentPassword");
  const newPasswordInput = document.getElementById("accountNewPassword");
  const submitButton = document.getElementById("accountSubmit");
  const feedback = document.getElementById("accountFeedback");

  const setFeedback = (message, isError = false) => {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.toggle("error", Boolean(isError));
    feedback.classList.toggle("ok", !isError && Boolean(message));
  };

  if (nameInput) nameInput.value = String(activeUser.name || "");
  if (emailInput) emailInput.value = String(activeUser.email || "");
  if (phoneInput) phoneInput.value = String(activeUser.phone || "");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      userId: String(activeUser.id || "").trim(),
      name: String(nameInput?.value || "").trim(),
      email: String(emailInput?.value || "").trim(),
      phone: String(phoneInput?.value || "").trim(),
      currentPassword: String(currentPasswordInput?.value || ""),
      newPassword: String(newPasswordInput?.value || "")
    };

    if (!payload.email && !payload.phone) {
      setFeedback("Debes conservar correo o telefono en tu cuenta.", true);
      return;
    }

    if (payload.newPassword && payload.newPassword.length < 8) {
      setFeedback("La nueva contrasena debe tener al menos 8 caracteres.", true);
      return;
    }

    if (payload.newPassword && !payload.currentPassword) {
      setFeedback("Para cambiar tu contrasena ingresa tu contrasena actual.", true);
      return;
    }

    setFeedback("");
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Guardando...";
    }

    try {
      const response = await fetch(`${STRIPE_API_BASE}/api/auth/update-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo actualizar la cuenta.");
      }

      if (data?.user) {
        saveAuthUser(data.user);
        renderHeaderAuth();
      }

      if (currentPasswordInput) currentPasswordInput.value = "";
      if (newPasswordInput) newPasswordInput.value = "";
      setFeedback("Detalles de cuenta actualizados correctamente.");
    } catch (error) {
      const rawMessage = String(error?.message || "").toLowerCase();
      const connectionError = rawMessage.includes("failed to fetch") || rawMessage.includes("networkerror");
      if (connectionError) {
        setFeedback("No se pudo conectar al servidor. Verifica que el backend este activo en http://localhost:4242.", true);
      } else {
        setFeedback(error?.message || "Error al actualizar la cuenta.", true);
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Guardar cambios";
      }
    }
  });
};

document.addEventListener("DOMContentLoaded", () => {
  renderHeaderAuth();
  initAuthUi();
  updateCartCount();
  bindAddButtons();
  initMenuToggle();
  initGallery();
  syncCatalogProductLinks();
  initCatalogFilters();
  initFeaturedProducts();
  initProductDetailPage();
  renderCart();
  initCheckoutSuccessPage();
  initPurchasesPage();
  initLoginForm();
  initRegisterForm();
  initAccountDetailsPage();
});
