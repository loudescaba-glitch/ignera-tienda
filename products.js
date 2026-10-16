// ---------- Productos de Ignera desde Google Sheets ----------
//
// Este archivo lee la planilla de Google (publicada como CSV) y arma
// las tarjetas de producto solo. Para agregar, editar o sacar una
// cartera, no hace falta tocar este archivo: se edita la planilla.
//
// Reemplazá el valor de abajo por el link de TU planilla publicada
// (ver instrucciones en COMO-ACTUALIZAR-PRODUCTOS.md).

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6VjngkA44XyV7lECiniHQPe5KSSFqM84cdNRkGz6hlm6-dzrFopmcswqMnHjgRrYn4WnC3B4MxGM3/pub?output=csv';

// Tamaños de tarjeta que se van repitiendo para que la grilla se vea
// pareja aunque cambie la cantidad de productos.
const CARD_SIZES = ['large', 'medium', 'medium', 'wide', 'narrow', 'narrow'];

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function csvToProducts(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {
    nombre: headers.indexOf('nombre'),
    descripcion: headers.indexOf('descripcion'),
    precio: headers.indexOf('precio'),
    imagen: headers.indexOf('imagen'),
    stock: headers.indexOf('stock'),
    categoria: headers.indexOf('categoria'),
  };

  return rows
    .slice(1)
    .map((r) => ({
      nombre: (r[idx.nombre] || '').trim(),
      descripcion: (r[idx.descripcion] || '').trim(),
      precio: (r[idx.precio] || '').trim(),
      imagen: (r[idx.imagen] || '').trim(),
      stock: (r[idx.stock] || '').trim().toLowerCase(),
      categoria: idx.categoria >= 0 ? (r[idx.categoria] || '').trim() : '',
    }))
    .filter((p) => p.nombre); // ignora filas vacías
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Secciones de la tienda, en el orden en que aparecen en la página.
// Una sección solo aparece si tiene al menos un producto.
const CATEGORIAS = [
  { id: 'carteras', titulo: 'Carteras' },
  { id: 'zapatillas', titulo: 'Zapatillas' },
  { id: 'gorros', titulo: 'Gorros' },
  { id: 'pulseras', titulo: 'Pulseras' },
];

// Si la planilla tiene una columna "categoria" se usa esa. Si no, la sección
// se deduce del nombre: "Zapatillas ...", "Gorra ...", "Pulsera ...", etc.
function categoriaDe(p) {
  const manual = (p.categoria || '').trim().toLowerCase();
  if (manual) {
    const m = CATEGORIAS.find((c) => c.id === manual || c.titulo.toLowerCase() === manual);
    if (m) return m.id;
  }
  const n = p.nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (/zapatilla/.test(n)) return 'zapatillas';
  if (/gorr|sombrero|visera/.test(n)) return 'gorros';
  if (/pulsera|munequera/.test(n)) return 'pulseras';
  return 'carteras';
}

let productCounter = 0;

function cardHtml(p) {
  const i = productCounter++;
  const size = CARD_SIZES[i % CARD_SIZES.length];
  const id = slugify(p.nombre);
  const precioNumero = (p.precio || '0').replace(/[^\d]/g, '');
  const precioFormateado = Number(precioNumero).toLocaleString('es-AR');
  const fotos = (p.imagen || '')
    .split(';')
    .map((f) => f.trim())
    .filter(Boolean);
  const mainImgId = `product-img-${i}`;

  const thumbsHtml =
    fotos.length > 1
      ? `<div class="thumbs">${fotos
          .map(
            (f, j) =>
              `<img src="${f}" class="thumb${j === 0 ? ' active' : ''}" loading="lazy" onclick="document.getElementById('${mainImgId}').src='${f}'; this.parentElement.querySelectorAll('.thumb').forEach(t=>t.classList.remove('active')); this.classList.add('active');">`
          )
          .join('')}</div>`
      : '';

  return `
    <div class="card ${size}">
      <div class="art">
        ${fotos[0] ? `<img id="${mainImgId}" src="${fotos[0]}" alt="${p.nombre}" loading="lazy">` : ''}
      </div>
      ${thumbsHtml}
      <div class="meta">
        <div>
          <h3>${p.nombre}</h3>
          <p class="tag">${p.descripcion}</p>
        </div>
        <span class="price">${Number(precioNumero) > 0 ? '$' + precioFormateado : 'Consultar'}</span>
      </div>
      <a class="wa-btn" target="_blank" rel="noopener" href="https://wa.me/5491166863434?text=${encodeURIComponent('Hola Ignera, quiero consultar por: ' + p.nombre)}">Consultar por WhatsApp</a>
      ${Number(precioNumero) > 0 ? `<button class="add-to-cart" data-id="${id}" data-name="${p.nombre}" data-price="${precioNumero}">Agregar a la bolsa</button>` : ''}
    </div>
  `;
}

function renderProducts(products) {
  const box = document.getElementById('product-sections');
  if (!box) return;

  const disponibles = products.filter((p) => p.stock !== 'no');

  if (disponibles.length === 0) {
    box.innerHTML =
      '<p style="text-align:center; color:#8f887e; padding:40px 0;">Por el momento no hay piezas disponibles.</p>';
    return;
  }

  productCounter = 0;
  box.innerHTML = CATEGORIAS.map((cat) => {
    const items = disponibles.filter((p) => categoriaDe(p) === cat.id);
    if (items.length === 0) return '';
    return `
      <div class="cat-block" id="cat-${cat.id}">
        <div class="cat-head">
          <h3>${cat.titulo}</h3>
          <span class="cat-count">${items.length} ${items.length === 1 ? 'pieza' : 'piezas'}</span>
        </div>
        <div class="grid">${items.map(cardHtml).join('')}</div>
      </div>
    `;
  }).join('');

  // Tarjetas de "Lo que hacemos": llevan a su sección; si todavía no hay
  // productos de esa categoría, muestran "Próximamente".
  document.querySelectorAll('.coll-card[data-cat]').forEach((card) => {
    if (!document.getElementById('cat-' + card.dataset.cat)) {
      const c = card.querySelector('.count');
      if (c) c.textContent = 'Próximamente';
      card.classList.add('soon');
      card.addEventListener('click', (e) => e.preventDefault());
    }
  });

  // Vuelve a activar los botones "Agregar a la bolsa" para los productos nuevos
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
}

async function loadProducts() {
  const grid = document.getElementById('product-sections');
  try {
    const res = await fetch(SHEET_CSV_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('No se pudo leer la planilla');
    const text = await res.text();
    const products = csvToProducts(text);
    renderProducts(products);
  } catch (err) {
    if (grid) {
      grid.innerHTML =
        '<p style="text-align:center; color:#8f887e; padding:40px 0;">No se pudieron cargar los productos. Revisá que la planilla esté publicada correctamente.</p>';
    }
  }
}

document.addEventListener('DOMContentLoaded', loadProducts);
