// Compra: quién atiende la venta y el total de cada medio, calculados por el servidor antes de pagar.
import { whatsappLink, whatsappMessages } from '/shared/site.config.mjs';
import { api, choosePlan, currentRef, esc, fmtDateTime, money, navigate, programOf, state } from './core.js';

export async function renderCheckout(main, slug) {
  const program = programOf(slug);
  if (!program) return null;
  const ref = currentRef();
  const data = await api(`/api/pricing/${slug}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`);
  if (data.alreadyIncluded) {
    main.innerHTML = `<div class="page-top"></div><section class="buy"><div class="wrap"><h1 class="display"><span class="hl">${esc(program.name)}</span></h1>
      <p class="lede">Tu plan actual ya incluye este contenido.</p><p><a class="btn btn--gold" href="/mi-cuenta/formacion"><span class="btn__in">Ir a mi formación</span></a></p></div></section>`;
    return undefined;
  }
  const { baseCents, kind, attendedBy, methods } = data;
  const card = methods.find((m) => m.method === 'tarjeta');
  const manual = methods.filter((m) => m.method !== 'tarjeta');
  const fx = manual.find((m) => m.fx)?.fx;
  const anyManual = manual.some((m) => m.available);

  main.innerHTML = `
  <div class="page-top"></div>
  <section class="buy" aria-labelledby="titulo-compra">
    <div class="wrap">
      <p class="crumb"><a class="link" href="/programas/${esc(slug)}">Volver al curso</a></p>
      <h1 id="titulo-compra" class="display">${kind === 'actualizacion' ? 'Sube a' : 'Compra'} <span class="hl">${esc(data.planName)}</span></h1>
      <p class="lede">${kind === 'actualizacion' ? 'Pagas solo la diferencia' : 'Pago único'}: <strong>${money(baseCents)}</strong>. Antes de pagar ves el total de cada medio.</p>
      <p class="auth__plan">Esta venta la atiende: <strong>${esc(attendedBy.name)}</strong>${attendedBy.name.endsWith('.') ? '' : '.'}${attendedBy.fallback ? ' Tu enlace de referido no permite ofrecer este plan, así que lo atiende Legado Digital como venta directa.' : ''}</p>
      ${state.salesOpen ? '' : '<div class="callout"><p>Las ventas aún no están abiertas: falta completar la configuración del negocio. Puedes consultarnos por WhatsApp.</p></div>'}
      <div class="buy__grid">
        <article class="buy-card" aria-labelledby="c-web">
          <h2 id="c-web">Pagar con tarjeta en la web</h2>
          <dl class="totals">
            <div><dt>Precio del curso</dt><dd>${money(baseCents)}</dd></div>
            <div><dt>Cargo de procesamiento a tu cargo</dt><dd>${card.available ? money(card.feeCents) : 'Por confirmar'}</dd></div>
            <div class="totals__sum"><dt>Total a pagar</dt><dd>${card.available ? money(card.chargeCents) : 'Por confirmar'}</dd></div>
          </dl>
          <p class="note">${card.available ? `Pagas en el checkout seguro del proveedor${state.sandbox ? ' (pasarela de pruebas: no se cobra nada)' : ''}. Esta web no guarda los datos de tu tarjeta.` : esc(card.reason)}</p>
        </article>
        <article class="buy-card" aria-labelledby="c-man">
          <h2 id="c-man">Comprar por WhatsApp con Yape o Plin</h2>
          <dl class="totals">${manual.map((m) => `<div><dt>${esc(m.name)}</dt><dd>${m.available ? money(m.chargeCents, m.currency) : '<span class="muted">No disponible</span>'}</dd></div>`).join('')}</dl>
          <p class="note">${fx ? `Tipo de cambio: S/ ${fx.rate / 10000} por dólar, vigente hasta ${fmtDateTime(fx.validUntil)}.` : 'El importe en soles necesita un tipo de cambio vigente configurado.'}
            Pagas a la cuenta indicada en tu pedido y envías el comprobante. Quien recibe el dinero comprueba el ingreso antes de activar tu acceso.</p>
        </article>
      </div>
      <p class="buy__hint">También puedes consultar el pago por Yape o Plin en WhatsApp. Compara el total antes de elegir.</p>
      <div class="hero-actions">
        <button class="btn btn--gold" type="button" id="seguir" ${state.salesOpen && (card.available || anyManual) ? '' : 'disabled'}><span class="btn__in">${state.user ? 'Crear mi pedido y elegir cómo pagar' : 'Crear cuenta para comprar'}</span></button>
        <a class="btn btn--line" href="${esc(whatsappLink(whatsappMessages.plan(program), ref))}" target="_blank" rel="noopener noreferrer"><span class="btn__in">Consultar por WhatsApp</span></a>
      </div>
      ${state.user ? '' : '<p class="note">Tu elección se conserva al registrarte.</p>'}
    </div>
  </section>`;

  main.querySelector('#seguir').addEventListener('click', async (e) => {
    if (!state.user) { navigate(`/registro?plan=${slug}`); return; }
    e.currentTarget.disabled = true;
    await choosePlan(slug);
  });
  return undefined;
}
