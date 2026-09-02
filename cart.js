// ---------- Carrito de Ignera ----------
// Guarda el carrito en el navegador del cliente (localStorage).
// No maneja tarjetas ni datos de pago: eso lo hace Mercado Pago directamente.

const CART_KEY = 'ignera-cart';

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCart();
}

function addToCart(id, name, price) {
  const cart = getCart();
  const existing = cart.find((i) => i.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id, name, price: Number(price), qty: 1 });
  }
  saveCart(cart);
  openCart();
}

function removeFromCart(id) {
  const cart = getCart().filter((i) => i.id !== id);
  saveCart(cart);
}

function changeQty(id, delta) {
  let cart = getCart();
  const item = cart.find((i) => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter((i) => i.id !== id);
  }
  saveCart(cart);
}

function cartCount() {
  return getCart().reduce((sum, i) => sum + i.qty, 0);
}

function cartTotal() {
  return getCart().reduce((sum, i) => sum + i.qty * i.price, 0);
}

function formatARS(n) {
  return n.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });
}

function renderCart() {
  const cart = getCart();

  document.querySelectorAll('.cart-count').forEach((el) => {
    el.textContent = cartCount();
  });

  const list = document.getElementById('cart-items');
  const emptyMsg = document.getElementById('cart-empty');
  const totalEl = document.getElementById('cart-total');
  if (!list) return;

  list.innerHTML = '';

  if (cart.length === 0) {
    if (emptyMsg) emptyMsg.style.display = 'block';
  } else {
    if (emptyMsg) emptyMsg.style.display = 'none';
    cart.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'cart-row';
      row.innerHTML = `
        <div class="cart-row-info">
          <p class="cart-row-name">${item.name}</p>
          <p class="cart-row-price">${formatARS(item.price)}</p>
        </div>
        <div class="cart-row-qty">
          <button type="button" data-action="minus" data-id="${item.id}">&minus;</button>
          <span>${item.qty}</span>
          <button type="button" data-action="plus" data-id="${item.id}">+</button>
        </div>
        <button type="button" class="cart-row-remove" data-action="remove" data-id="${item.id}">&times;</button>
      `;
      list.appendChild(row);
    });
  }

  if (totalEl) totalEl.textContent = formatARS(cartTotal());
}

function openCart() {
  document.getElementById('cart-drawer').classList.add('open');
  document.getElementById('cart-overlay').classList.add('open');
}

function closeCart() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('cart-overlay').classList.remove('open');
}

async function checkout() {
  const cart = getCart();
  if (cart.length === 0) return;

  const btn = document.getElementById('checkout-btn');
  btn.disabled = true;
  btn.textContent = 'Redirigiendo a Mercado Pago...';

  try {
    const res = await fetch('/api/create-preference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cart }),
    });

    const data = await res.json();

    if (res.ok && data.init_point) {
      window.location.href = data.init_point;
    } else {
      alert('Hubo un problema al generar el pago. Probá de nuevo en unos segundos.');
      btn.disabled = false;
      btn.textContent = 'Finalizar compra';
    }
  } catch (err) {
    alert('No se pudo conectar con el servidor de pagos. Revisá tu conexión e intentá de nuevo.');
    btn.disabled = false;
    btn.textContent = 'Finalizar compra';
  }
}

function showBanner(msg) {
  const b = document.getElementById('status-banner');
  if (!b) return;
  b.textContent = msg;
  b.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
  renderCart();

  document.querySelectorAll('.add-to-cart').forEach((btn) => {
    btn.addEventListener('click', () => {
      addToCart(btn.dataset.id, btn.dataset.name, btn.dataset.price);
      const original = btn.textContent;
      btn.classList.add('added');
      btn.textContent = 'Agregado ✓';
      setTimeout(() => {
        btn.classList.remove('added');
        btn.textContent = original;
      }, 1200);
    });
  });

  document.getElementById('cart-items').addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    const id = e.target.dataset.id;
    if (!action) return;
    if (action === 'plus') changeQty(id, 1);
    if (action === 'minus') changeQty(id, -1);
    if (action === 'remove') removeFromCart(id);
  });

  // Mensaje según el resultado del pago al volver de Mercado Pago
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');
  if (status === 'success') {
    localStorage.removeItem(CART_KEY);
    renderCart();
    showBanner('¡Gracias por tu compra! Te vamos a contactar para coordinar la entrega.');
  } else if (status === 'failure') {
    showBanner('El pago no se pudo procesar. Podés intentar de nuevo cuando quieras.');
  } else if (status === 'pending') {
    showBanner('Tu pago quedó pendiente de aprobación. Te avisamos apenas se confirme.');
  }
});
