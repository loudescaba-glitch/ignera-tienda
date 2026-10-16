// api/create-preference.js
//
// Esta función corre en el servidor de Vercel, nunca en el navegador del
// cliente. Es la única parte del proyecto que conoce el Access Token de
// Mercado Pago (se lee de una variable de entorno, nunca queda escrito
// en el código).
//
// Recibe del navegador SOLO qué productos y cuántas unidades quiere el
// cliente. Los PRECIOS se leen acá, desde la planilla de Google, para que
// nadie pueda cambiar un precio desde su navegador. Después crea la
// "preferencia" de pago en Mercado Pago y devuelve la URL para redirigir
// al comprador a pagar.
//
// Variables de entorno (Vercel → Settings → Environment Variables):
//   MP_ACCESS_TOKEN  (obligatoria) Access Token de Mercado Pago
//   SHIPPING_COST    (opcional)    costo fijo de envío en pesos, ej: 8000.
//                                  Si no está o es 0, el envío se coordina
//                                  por WhatsApp y no se cobra acá.

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6VjngkA44XyV7lECiniHQPe5KSSFqM84cdNRkGz6hlm6-dzrFopmcswqMnHjgRrYn4WnC3B4MxGM3/pub?output=csv';

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
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Devuelve { slug: { nombre, precio, disponible } } desde la planilla.
async function loadCatalog() {
  const res = await fetch(SHEET_CSV_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudo leer la planilla');
  const rows = parseCSV(await res.text());
  if (rows.length < 2) return {};
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const iNombre = headers.indexOf('nombre');
  const iPrecio = headers.indexOf('precio');
  const iStock = headers.indexOf('stock');
  const catalog = {};
  rows.slice(1).forEach((r) => {
    const nombre = (r[iNombre] || '').trim();
    if (!nombre) return;
    catalog[slugify(nombre)] = {
      nombre,
      precio: Number((r[iPrecio] || '0').replace(/[^\d]/g, '')) || 0,
      disponible: (r[iStock] || '').trim().toLowerCase() !== 'no',
    };
  });
  return catalog;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    res.status(500).json({
      error: 'Falta configurar la variable de entorno MP_ACCESS_TOKEN en Vercel.',
    });
    return;
  }

  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'El carrito está vacío.' });
    return;
  }
  if (items.length > 30) {
    res.status(400).json({ error: 'El carrito tiene demasiados productos.' });
    return;
  }

  let catalog;
  try {
    catalog = await loadCatalog();
  } catch (err) {
    res.status(502).json({ error: 'No se pudo verificar los precios. Probá de nuevo.' });
    return;
  }

  // Armamos los items con el precio REAL de la planilla.
  const mpItems = [];
  for (const it of items) {
    const prod = catalog[slugify(it.id || it.name || '')];
    if (!prod || !prod.disponible || prod.precio <= 0) {
      res.status(400).json({
        error: `"${String(it.name || it.id).slice(0, 80)}" ya no está disponible o no tiene precio.`,
      });
      return;
    }
    mpItems.push({
      title: prod.nombre.slice(0, 256),
      quantity: Math.min(10, Math.max(1, parseInt(it.qty, 10) || 1)),
      unit_price: prod.precio,
      currency_id: 'ARS',
    });
  }

  // Envío fijo opcional (si no se configura, se coordina por WhatsApp).
  const shipping = Number(process.env.SHIPPING_COST) || 0;
  if (shipping > 0) {
    mpItems.push({
      title: 'Envío',
      quantity: 1,
      unit_price: shipping,
      currency_id: 'ARS',
    });
  }

  const origin = req.headers.origin || `https://${req.headers.host}`;

  const preferenceBody = {
    items: mpItems,
    back_urls: {
      success: `${origin}/?status=success`,
      failure: `${origin}/?status=failure`,
      pending: `${origin}/?status=pending`,
    },
    auto_return: 'approved',
    statement_descriptor: 'IGNERA',
  };

  try {
    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preferenceBody),
    });

    const data = await mpRes.json();

    if (!mpRes.ok) {
      res.status(mpRes.status).json({ error: data });
      return;
    }

    res.status(200).json({ init_point: data.init_point });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo conectar con Mercado Pago.' });
  }
};
