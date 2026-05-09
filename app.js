const CART_KEY = "tusllantas-cart";
const STRIPE_API_BASE = "http://localhost:4242";

const readCart = () => {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
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

  document.querySelectorAll(".thumb").forEach((thumb) => {
    thumb.addEventListener("click", () => {
      const src = thumb.dataset.src;
      mainImage.src = src;

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

  applyFilters();
};

const renderCart = () => {
  const container = document.getElementById("cartItemsContainer");
  if (!container) return;

  const subtotalValue = document.getElementById("subtotalValue");
  const shippingValue = document.getElementById("shippingValue");
  const discountValue = document.getElementById("discountValue");
  const totalValue = document.getElementById("totalValue");
  const shippingState = document.getElementById("shippingState");
  const couponCode = document.getElementById("couponCode");
  const applyCoupon = document.getElementById("applyCoupon");
  const checkoutButton = document.getElementById("checkoutButton");

  let discount = 0;

  const calculate = () => {
    const cart = readCart();
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const shipping = Number(shippingState.value || 0);
    const total = Math.max(0, subtotal + shipping - discount);

    subtotalValue.textContent = formatPrice(subtotal);
    shippingValue.textContent = formatPrice(shipping);
    discountValue.textContent = `-${formatPrice(discount)}`;
    totalValue.textContent = formatPrice(total);
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
        (item, index) => `
          <article class=\"cart-item\">
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
        `
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

  shippingState.addEventListener("change", calculate);

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

  if (checkoutButton) {
    checkoutButton.addEventListener("click", async () => {
      const items = readCart();

      if (!items.length) {
        const note = document.getElementById("cartEmptyNote");
        if (note) { note.hidden = false; setTimeout(() => { note.hidden = true; }, 3500); }
        return;
      }

      checkoutButton.disabled = true;
      checkoutButton.textContent = "Conectando con Stripe...";

      try {
        const response = await fetch(`${STRIPE_API_BASE}/api/create-checkout-session`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            items,
            shippingCost: Number(shippingState.value || 0),
            couponCode: (couponCode.value || "").trim().toUpperCase(),
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
};

document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
  bindAddButtons();
  initMenuToggle();
  initGallery();
  initCatalogFilters();
  renderCart();
});
