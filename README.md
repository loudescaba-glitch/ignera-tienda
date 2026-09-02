# Ignera — tienda con carrito y pago real (Mercado Pago)

Este proyecto son 3 partes:

- `index.html` + `cart.js` → el sitio y el carrito (corren en el navegador del cliente).
- `api/create-preference.js` → un mini servidor (function serverless) que le pide a Mercado Pago el link de pago. Es la única parte que conoce tu clave secreta.
- Nada de esto guarda ni ve tarjetas: eso pasa en la pantalla de Mercado Pago.

No hace falta pagar nada para tenerlo funcionando de verdad.

---

## Paso 1 — Crear cuenta en GitHub (si no tenés)

Anda a [github.com](https://github.com) y creá una cuenta gratis.

## Paso 2 — Subir este proyecto a un repositorio

1. En GitHub, tocá **New repository**. Nombralo `ignera-tienda`. Dejalo privado o público, como prefieras.
2. Subí estos archivos tal cual están (podés arrastrarlos desde la opción "uploading an existing file" en la propia web de GitHub, sin usar la terminal).

## Paso 3 — Crear tu cuenta de Mercado Pago Developers

1. Entrá a [mercadopago.com.ar/developers](https://www.mercadopago.com.ar/developers/panel) con tu cuenta de Mercado Pago (o creá una).
2. Andá a **Tus integraciones** → **Crear aplicación**. Elegí "Pagos online" / Checkout Pro.
3. En la sección **Credenciales de producción** vas a ver dos claves: *Public Key* y *Access Token*. Copiá el **Access Token** — es el único que necesita este proyecto.
4. Mientras estés probando, usá las **Credenciales de prueba** en vez de las de producción, para no procesar pagos reales por error (más abajo te explico cómo simular una compra).

⚠️ Nunca pegues este Access Token dentro del código ni lo subas a GitHub. Va únicamente en el paso 5.

## Paso 4 — Importar el proyecto en Vercel

1. Entrá a [vercel.com](https://vercel.com) y creá una cuenta gratis con tu usuario de GitHub.
2. Tocá **Add New → Project**, elegí el repositorio `ignera-tienda` y dale **Import**.
3. No hace falta tocar ninguna configuración de build: Vercel detecta solo el archivo `index.html` y la carpeta `api/`.

## Paso 5 — Cargar tu clave de Mercado Pago en Vercel

1. Dentro del proyecto en Vercel, andá a **Settings → Environment Variables**.
2. Agregá una variable:
   - **Name:** `MP_ACCESS_TOKEN`
   - **Value:** el Access Token que copiaste en el Paso 3
3. Guardá, y volvé a **Deployments** → tocá los tres puntitos del último deploy → **Redeploy** (para que tome la variable nueva).

## Paso 6 — ¡Listo!

Vercel te da una URL como `ignera-tienda.vercel.app`. Entrá, agregá una cartera a la bolsa, tocá **Finalizar compra** y te va a redirigir a Mercado Pago.

- Si usaste las credenciales de **prueba**, Mercado Pago te deja pagar con [tarjetas de prueba](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards) sin mover dinero real.
- Cuando quieras cobrar de verdad, repetí el Paso 5 pero con el Access Token de **producción**.

---

## Cómo agregar o editar productos

Cada tarjeta de producto en `index.html` tiene un botón así:

```html
<button class="add-to-cart" data-id="sobre-rioja" data-name="Sobre Rioja" data-price="148000">Agregar a la bolsa</button>
```

- `data-id`: un identificador único, sin espacios (ej: `cartera-nueva`).
- `data-name`: el nombre que va a aparecer en el carrito y en Mercado Pago.
- `data-price`: el precio en pesos, sin puntos ni comas (ej: `85000` para $85.000).

No necesitás tocar `cart.js` ni `api/create-preference.js` para agregar productos nuevos — solo copiar una tarjeta completa en `index.html`, cambiar la imagen, el texto y estos tres datos.

## Si algo no funciona

- **"Falta configurar MP_ACCESS_TOKEN"**: te faltó el Paso 5, o falta hacer Redeploy después de cargarlo.
- **El botón "Finalizar compra" no responde**: abrí la consola del navegador (F12 → pestaña Console) y fijate el error — casi siempre es la variable de entorno.
- **Querés ver los pagos recibidos**: entrá a tu cuenta normal de Mercado Pago → Actividad.
