// Pasarela de pruebas. Cumple la misma interfaz que tendrá el proveedor real y no cobra nada.
// Interfaz: createCheckout({ order }) => { url, ref }   getStatus(order) => evento | null
export function sandboxProvider() {
  const results = new Map();
  return {
    name: 'sandbox',
    createCheckout: ({ order }) => ({ url: `/sandbox/checkout/${order.id}`, ref: `sbx-${order.id}-${Date.now()}` }),
    record(order, result) {
      const event = { id: `sbx-${order.id}-${result}-${results.size + 1}`, orderId: order.id, type: result, amountCents: order.charge_cents, currency: order.charge_currency };
      results.set(order.id, event);
      return event;
    },
    getStatus: (order) => results.get(order.id) || null,
  };
}

export const sandboxPage = (order) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pasarela de pruebas | Legado Digital</title><link rel="icon" href="/assets/logo/favicon.png">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b0d;color:#f4ecdd;font:16px/1.5 system-ui,sans-serif;padding:16px}
main{max-width:420px;width:100%;border:1px dashed #d9b875;padding:28px}h1{font-size:1.4rem;margin:0 0 .5rem}p{color:#b8b3aa}
button{width:100%;min-height:48px;margin-top:12px;font:600 1rem system-ui;cursor:pointer;border:1px solid #d9b875}
.ok{background:#d9b875;color:#15110a}.ko{background:none;color:#f0d69c}strong{color:#f0d69c}</style></head><body><main>
<h1>Pasarela de pruebas</h1><p>Esto no es un cobro real. Simula la respuesta del proveedor de pagos para el pedido <strong>LD-${String(order.id).padStart(6, '0')}</strong> por <strong>US$${(order.charge_cents / 100).toFixed(2)}</strong>.</p>
<form method="post" action="/sandbox/checkout/${order.id}"><button class="ok" name="result" value="paid">Simular pago completado</button><button class="ko" name="result" value="failed">Simular pago fallido</button></form>
</main></body></html>`;
