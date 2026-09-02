// api/create-preference.js
//
// Esta función corre en el servidor de Vercel, nunca en el navegador del
// cliente. Es la única parte del proyecto que conoce el Access Token de
// Mercado Pago (se lee de una variable de entorno, nunca queda escrito
// en el código). Recibe el carrito, crea una "preferencia" de pago en
// Mercado Pago, y le devuelve al navegador la URL de Checkout Pro para
// redirigir al comprador ahí a pagar.

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

  // Validamos y normalizamos cada item antes de mandarlo a Mercado Pago.
  const mpItems = items.map((it) => ({
    title: String(it.name).slice(0, 256),
    quantity: Math.max(1, parseInt(it.qty, 10) || 1),
    unit_price: Math.max(0, Number(it.price) || 0),
    currency_id: 'ARS',
  }));

  const origin =
    req.headers.origin || `https://${req.headers.host}`;

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
