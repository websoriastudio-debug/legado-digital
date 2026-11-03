// Experiencia pública: portada, apartados y demostraciones educativas.
import { acceptedCards, brand, comparison, faqs, payments, socials, USD, whatsapp, whatsappLink, whatsappMessages } from '/shared/site.config.mjs';
import { audience, contactTips, glossary, manifesto, marquee, syllabus } from '/shared/content.mjs';
import { api, currentRef, esc, fieldError, state, toast } from './core.js';
import { initCounters, initRail, initReveals, initSilk, initThread, initTilt, initWordLight } from './effects.js';
import { initLogo3D } from './logo3d.js';

const wa = (msg) => whatsappLink(msg, currentRef());
export const btn = (label, attrs = '', cls = 'btn--gold') => `<a class="btn ${cls}" ${attrs}><span class="btn__in">${esc(label)}</span></a>`;
const waBtn = (label, msg, cls = 'btn--ghost') => btn(label, `href="${esc(wa(msg))}" target="_blank" rel="noopener noreferrer"`, cls);

function lines(text) {
  // Lo escrito entre asteriscos va en el color de acento.
  return text.map((l, i) => `<span class="line"><span style="--i:${i}">${esc(l).replace(/\*(.+?)\*/g, '<span class="hl">$1</span>')}</span></span>`).join(' ');
}

/* ---------- Inicio ---------- */
const hero = () => {
  const prices = state.programs.map((p) => USD(p.priceCents));
  return `
<section class="s-hero" id="inicio" aria-labelledby="titulo-inicio">
  <div class="s-hero__stage">
    <canvas class="s-hero__silk" aria-hidden="true"></canvas>
    <div class="s-hero__veil" aria-hidden="true"></div>
    <canvas class="s-hero__gl" aria-hidden="true"></canvas>
    <div class="s-hero__grid">
      <div class="s-hero__logo" id="logo-hero">
        <img src="${brand.logo.full720}" srcset="${brand.logo.full720} 720w, ${brand.logo.full} 1254w" sizes="(min-width: 1024px) 44vw, 72vw" width="1254" height="1254" alt="${esc(brand.logo.alt)}" fetchpriority="high">
      </div>
      <div class="s-hero__copy">
        <h1 id="titulo-inicio" class="hero-title">${lines(['Aprende marketing.', 'Construye tu', '*negocio digital.*'])}</h1>
        <p class="hero-sub">Cursos de marketing digital, ventas, contenido y automatización para emprendedores. Empieza con START y avanza con PRO o ELITE.</p>
        <div class="hero-actions">
          ${btn('Ver los cursos', 'href="/#cursos-y-planes"')}
          ${waBtn('Hablar por WhatsApp', whatsappMessages.general())}
        </div>
      </div>
    </div>
    <p class="s-hero__levels" aria-hidden="true"><strong>START, PRO y ELITE</strong><span>Tres niveles de pago único: ${prices[0]}, ${prices[1]} y ${prices[2]}.</span></p>
  </div>
</section>`;
};

function initHero(root) {
  const section = root.querySelector('.s-hero');
  const stage = section.querySelector('.s-hero__stage');
  const copy = section.querySelector('.s-hero__copy');
  const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  return initLogo3D({
    canvas: section.querySelector('.s-hero__gl'),
    stage, section,
    anchor: section.querySelector('#logo-hero'),
    src: brand.logo.full,
    onScene: (p) => {
      const c = 1 - smooth(0, 0.2, p);
      stage.style.setProperty('--copy', c.toFixed(3));
      // Oculto del todo para que sus botones no reciban foco ni clics cuando ya no se ven.
      copy.classList.toggle('is-gone', c < 0.02);
      stage.style.setProperty('--levels', (smooth(0.28, 0.38, p) * (1 - smooth(0.56, 0.64, p))).toFixed(3));
      stage.style.setProperty('--gl', (1 - smooth(0.84, 0.98, p)).toFixed(3));
      stage.style.setProperty('--out', smooth(0.86, 1, p).toFixed(3));
    },
  });
}

/* ---------- Para quién es ---------- */
const forSection = () => {
  const row = (hidden) => `<ul ${hidden ? 'aria-hidden="true"' : ''}>${marquee.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  return `
<div class="ticker" aria-label="Temas de los cursos"><div class="ticker__track">${row(false)}${row(true)}${row(true)}${row(true)}</div></div>
<section class="s-for" aria-labelledby="titulo-para-quien">
  <div class="wrap">
    <h2 id="titulo-para-quien" class="manifesto" data-words>${manifesto.split(' ').map((w, i, all) => `<span class="w${i >= all.indexOf('Eso') ? ' hl' : ''}">${esc(w)}</span>`).join(' ')}</h2>
    <div class="info-cards">
      ${audience.map((a, i) => `<article class="info-card rv" style="--d:${i * 120}ms"><h3>${esc(a.title)}</h3><ul>${a.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></article>`).join('')}
    </div>
  </div>
</section>`;
};

/* ---------- Qué aprenderás ---------- */
const MODULES = [
  { id: 'marketing', title: 'Marketing digital', level: 'Se estudia desde START', text: 'Las ventas dependen de cuántas personas te ven y de cuántas deciden comprar. Mueve los valores y mira la relación.', demo: () => `
    <div class="calc">
      <label for="d-visitas">Personas que ven tu oferta <output id="d-visitas-v"></output><input id="d-visitas" type="range" min="100" max="5000" step="100" value="1000"></label>
      <label for="d-conv">De cada 100, cuántas compran <output id="d-conv-v"></output><input id="d-conv" type="range" min="1" max="10" step="1" value="2"></label>
    </div>
    <div class="phone-line calc__result" aria-live="polite"><strong id="d-ventas"></strong><span>ventas en este ejemplo</span></div>
    <p class="note">Cifras inventadas para entender la relación. No es una previsión de resultados.</p>` },
  { id: 'whatsapp', title: 'WhatsApp Business', level: 'Se estudia desde START', text: 'Un perfil ordenado responde antes de que te pregunten. Activa cada parte y compara.', demo: () => `
    <div class="checks">
      ${[['foto', 'Foto clara'], ['desc', 'Descripción'], ['hora', 'Horario'], ['cat', 'Catálogo']].map(([k, l]) => `<label class="check"><input type="checkbox" data-part="${k}" ${k === 'foto' ? 'checked' : ''}><span>${l}</span></label>`).join('')}
    </div>
    <div class="wa-profile" aria-label="Perfil de ejemplo">
      <div class="wa-profile__pic" data-show="foto"></div>
      <div><strong>Dulce Taller</strong>
        <p data-show="desc">Tortas por encargo en Lima. Pide con 48 horas.</p>
        <p data-show="hora">Lunes a sábado, de 9:00 a 18:00.</p>
        <p data-show="cat" class="wa-profile__cat">Ver catálogo: 12 productos</p>
      </div>
    </div>
    <p class="note">Negocio inventado, solo como ejemplo.</p>` },
  { id: 'contenido', title: 'Contenido', level: 'Se estudia desde START', text: 'Una buena publicación parte de una duda real de tu cliente. Combina un tema y un formato.', demo: () => `
    <div class="demo-grid">
      <div class="field"><label for="d-tema">Qué duda resuelves</label><select id="d-tema">
        <option value="cuánto tiempo toma recibir un pedido">Plazos de entrega</option>
        <option value="cómo elegir la opción adecuada">Cómo elegir</option>
        <option value="qué errores evitar antes de comprar">Errores comunes</option>
      </select></div>
      <div class="field"><label for="d-formato">En qué formato</label><select id="d-formato">
        <option value="Video corto">Video corto</option>
        <option value="Carrusel de cinco imágenes">Carrusel</option>
        <option value="Estado de WhatsApp">Estado de WhatsApp</option>
      </select></div>
    </div>
    <div class="phone-line" aria-live="polite"><span class="phone-line__label">Tu idea de publicación</span><p id="d-idea"></p></div>` },
  { id: 'ventas', title: 'Ventas', level: 'Se estudia desde START y se amplía en PRO', text: 'Una conversación comercial tiene etapas. Recorre un ejemplo de principio a fin.', demo: () => `
    <div class="stages" role="group" aria-label="Etapas de la conversación">
      ${['Primer contacto', 'Necesidad', 'Propuesta', 'Seguimiento'].map((s, i) => `<button type="button" class="stage" data-stage="${i}" aria-pressed="${i === 0}">${s}</button>`).join('')}
    </div>
    <div class="bubble" id="d-bubble" aria-live="polite"></div>
    <p class="note">Mensaje de ejemplo. Adáptalo a tu forma de hablar.</p>` },
  { id: 'marca', title: 'Marca', level: 'Se estudia en ELITE', text: 'Define a quién ayudas y cómo decirlo en una frase que cualquiera pueda repetir.', demo: () => `
    <div class="demo-grid">
      <div class="field"><label for="d-quien">A quién ayudas</label><input id="d-quien" value="emprendedoras de repostería"></div>
      <div class="field"><label for="d-que">Qué consiguen contigo</label><input id="d-que" value="ordenar sus pedidos por WhatsApp"></div>
    </div>
    <div class="phone-line" aria-live="polite">
      <span class="phone-line__label">Así se leería en tu perfil</span>
      <p id="d-frase"></p>
    </div>` },
  { id: 'automatizacion', title: 'Automatización', level: 'Se estudia en ELITE', text: 'Automatizar es decidir qué pasa después de cada evento y qué sigue en tus manos. Elige un evento.', demo: () => `
    <div class="field" style="margin-bottom:1rem"><label for="d-evento">Cuando ocurre esto</label><select id="d-evento">
      <option value="0">Alguien escribe por primera vez</option>
      <option value="1">Alguien pide el catálogo</option>
      <option value="2">Pasan dos días sin respuesta</option>
    </select></div>
    <div class="flow" id="d-flujo" aria-live="polite"></div>
    <p class="note">Flujo de ejemplo. Revisa siempre lo que se envía en tu nombre.</p>` },
];

const learn = () => `
<section class="s-learn" id="que-aprenderas" aria-labelledby="titulo-aprender">
  <div class="wrap">
    <h2 id="titulo-aprender" class="display rv-lines">${lines(['Qué aprenderás,', '*probándolo aquí.*'])}</h2>
    <p class="learn__note rv">Estas demostraciones son gratuitas y funcionan sin registrarte. Las lecciones de cada curso se ven desde tu cuenta, cuando tu pago está confirmado y tu cuenta activada.</p>
    <div class="learn">
      <div class="learn__tabs" role="tablist" aria-label="Temas" aria-orientation="vertical">
        ${MODULES.map((m, i) => `<button role="tab" type="button" id="tab-${m.id}" aria-controls="panel-${m.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(m.title)}</button>`).join('')}
      </div>
      <div class="learn__panels">
        ${MODULES.map((m, i) => `<div role="tabpanel" id="panel-${m.id}" aria-labelledby="tab-${m.id}" tabindex="0" ${i === 0 ? '' : 'hidden'}>
          <span class="level-tag">${esc(m.level)}</span>
          <p class="lede">${esc(m.text)}</p>${m.demo()}</div>`).join('')}
      </div>
    </div>
  </div>
</section>`;

const STAGE_TEXT = [
  'Hola, Ana. Vi que preparas tortas por encargo. ¿Te puedo hacer una pregunta sobre cómo recibes tus pedidos?',
  '¿Qué es lo que más tiempo te quita hoy: responder consultas, cobrar o coordinar las entregas?',
  'Con lo que me cuentas, empezaría por ordenar tu catálogo y tus respuestas rápidas. ¿Te envío cómo se vería?',
  'Hola, Ana. Quedamos en hablar esta semana. ¿Sigues interesada o lo dejamos para más adelante? Cualquier respuesta me ayuda.',
];
const FLOWS = [
  ['Llega un mensaje nuevo', 'Se envía un saludo con tu horario y tres opciones', 'Respondes tú a quien necesite algo más'],
  ['Alguien escribe «catálogo»', 'Se envía el enlace a tu catálogo', 'Atiendes las dudas sobre cada producto'],
  ['Pasan dos días sin respuesta', 'Aparece un recordatorio en tu lista', 'Decides si escribir y con qué mensaje'],
];

function initLearn(root) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
      root.querySelector(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    });
    if (focus) tab.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length], true); }
      if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
      if (e.key === 'End') { e.preventDefault(); select(tabs.at(-1), true); }
    });
  });

  const $ = (s) => root.querySelector(s);
  const calc = () => {
    const v = Number($('#d-visitas').value), c = Number($('#d-conv').value);
    $('#d-visitas-v').textContent = v.toLocaleString('es');
    $('#d-conv-v').textContent = c;
    $('#d-ventas').textContent = Math.round(v * c / 100).toLocaleString('es');
  };
  $('#d-visitas').addEventListener('input', calc); $('#d-conv').addEventListener('input', calc); calc();

  const parts = root.querySelectorAll('[data-part]');
  const syncParts = () => parts.forEach((c) => root.querySelector(`[data-show="${c.dataset.part}"]`).classList.toggle('is-off', !c.checked));
  parts.forEach((c) => c.addEventListener('change', syncParts)); syncParts();

  const idea = () => { $('#d-idea').textContent = `${$('#d-formato').value} que explica ${$('#d-tema').value}.`; };
  $('#d-tema').addEventListener('change', idea); $('#d-formato').addEventListener('change', idea); idea();

  const stages = [...root.querySelectorAll('.stage')];
  const showStage = (b) => {
    stages.forEach((s) => s.setAttribute('aria-pressed', s === b));
    const bubble = $('#d-bubble');
    bubble.textContent = STAGE_TEXT[b.dataset.stage];
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
  };
  stages.forEach((s) => s.addEventListener('click', () => showStage(s))); showStage(stages[0]);

  const frase = () => { $('#d-frase').textContent = `Ayudo a ${$('#d-quien').value || '…'} a ${$('#d-que').value || '…'}.`; };
  $('#d-quien').addEventListener('input', frase); $('#d-que').addEventListener('input', frase); frase();

  const flow = () => {
    const f = FLOWS[$('#d-evento').value];
    $('#d-flujo').innerHTML = ['Evento', 'Automático', 'Tú'].map((l, i) => `<div><small>${l}</small>${esc(f[i])}</div>`).join('');
  };
  $('#d-evento').addEventListener('change', flow); flow();
}

/* ---------- Cursos y planes ---------- */
const check = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2.5 8.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

export const buyHref = (p, channel) => `/comprar/${p.slug}?canal=${channel}`;

const plan = (p, i) => `
<article class="tier tier--${p.slug} rv" style="--d:${i * 130}ms" aria-labelledby="plan-${p.slug}">
  <div class="tier__head">
    <p class="tier__level">${esc(p.level)}</p>
    <h3 id="plan-${p.slug}">${esc(p.name)}</h3>
    <p class="tier__price" data-count="${p.priceCents}">${USD(p.priceCents)}</p>
    <p class="tier__once">Pago único</p>
  </div>
  <p class="tier__tagline">${esc(p.tagline)}</p>
  <ul class="tier__list">${p.features.map((f) => `<li>${check}<span>${esc(f)}</span></li>`).join('')}</ul>
  <div class="tier__actions">
    ${btn('Pagar con tarjeta en la web', `href="${buyHref(p, 'web')}"`, p.rank === 3 ? 'btn--gold' : 'btn--line')}
    ${btn('Comprar por WhatsApp con Yape o Plin', `href="${buyHref(p, 'whatsapp')}"`, 'btn--line')}
    ${waBtn('Consultar por WhatsApp', whatsappMessages.plan(p), 'btn--text')}
    <a class="link" href="/programas/${p.slug}">Ver el curso ${esc(p.name)}</a>
  </div>
</article>`;

export const comparisonTable = () => `
<div class="compare rv">
  <table>
    <caption>Comparación de los tres niveles</caption>
    <thead><tr><td></td>${state.programs.map((p) => `<th scope="col">${esc(p.name)}</th>`).join('')}</tr></thead>
    <tbody>
      <tr><th scope="row">Pago único</th>${state.programs.map((p) => `<td data-plan="${esc(p.name)}">${USD(p.priceCents)}</td>`).join('')}</tr>
      ${comparison.map(([label, ...cells]) => `<tr><th scope="row">${esc(label)}</th>${cells.map((c, i) => `<td data-plan="${esc(state.programs[i].name)}" class="${c === 'No' ? 'is-no' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>
</div>`;

const syllabusList = (p) => {
  const lower = state.programs.filter((o) => o.rank < p.rank).map((o) => o.name).join(' y ');
  return `${lower ? `<p class="syllabus__inherit">Incluye todo ${esc(lower)}, además de:</p>` : ''}
    <ul class="syllabus__list">${syllabus[p.slug].map(([t, d], i) => `<li style="--i:${i}"><h4>${esc(t)}</h4><p>${esc(d)}</p></li>`).join('')}</ul>`;
};

const syllabusBlock = () => `
<div class="syllabus rv">
  <h3>El temario, tema por tema</h3>
  <p>Elige un nivel y lee qué cubre cada tema. Si una lección aún no está cargada, tu cuenta lo indica.</p>
  <div class="syllabus__tabs" role="tablist" aria-label="Niveles">
    ${state.programs.map((p, i) => `<button type="button" role="tab" id="sy-${p.slug}" aria-controls="sy-panel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-sy="${p.slug}">${esc(p.name)}</button>`).join('')}
  </div>
  <div id="sy-panel" role="tabpanel" aria-labelledby="sy-start" tabindex="0">${syllabusList(state.programs[0])}</div>
</div>`;

function initSyllabus(root) {
  const tabs = [...root.querySelectorAll('[data-sy]')];
  const panel = root.querySelector('#sy-panel');
  if (!panel) return;
  const pick = (t, focus) => {
    tabs.forEach((x) => { x.setAttribute('aria-selected', x === t); x.tabIndex = x === t ? 0 : -1; });
    panel.setAttribute('aria-labelledby', t.id);
    panel.innerHTML = syllabusList(state.programs.find((p) => p.slug === t.dataset.sy));
    if (focus) t.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => pick(t));
    t.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); pick(tabs[(i + d + tabs.length) % tabs.length], true); }
    });
  });
}

export const programsSection = (headingLevel = 'h2') => `
<section class="s-programs" id="cursos-y-planes" aria-labelledby="titulo-programas">
  <div class="wrap">
    <div class="s-programs__intro">
      <${headingLevel} id="titulo-programas" class="display rv-lines">${lines(['Tres cursos.', 'Cada nivel suma', '*al anterior.*'])}</${headingLevel}>
      <p class="lede rv">Pagas una sola vez. Puedes empezar por uno y subir más adelante pagando solo la diferencia.</p>
    </div>
    <div class="tiers">${state.programs.map(plan).join('')}</div>
    <p class="buy__hint rv">También puedes consultar el pago por Yape o Plin en WhatsApp. Compara el total antes de elegir.</p>
    ${comparisonTable()}
    ${syllabusBlock()}
  </div>
</section>`;

/* ---------- Cómo empezar ---------- */
const STEPS = [
  ['Elige tu curso', 'Compara los tres niveles y quédate con el que te sirve hoy. Puedes consultarnos por WhatsApp sin registrarte.'],
  ['Compara y crea tu cuenta', 'Ves el total con tarjeta y por Yape o Plin. Tu elección se conserva y aparece en tu cuenta como un pedido pendiente.'],
  ['Paga por el canal que elegiste', 'Con tarjeta, en el checkout seguro del proveedor. Por WhatsApp, envías el mensaje con tu pedido y pagas con Yape o Plin; después puedes subir tu comprobante.'],
  ['Se comprueba tu pago', 'La pasarela confirma el pago con tarjeta. En un pago manual, quien recibe el dinero comprueba que llegó. Una captura o un mensaje no bastan por sí solos.'],
  ['Se activa tu acceso', 'Al aprobarse el pago se habilita tu plan y aparece tu oficina con tus cursos y tu enlace. Si una lección aún no está publicada, la verás indicada.'],
];
const howSection = () => `
<section class="s-how" id="como-empezar" aria-labelledby="titulo-como">
  <div class="wrap s-how__grid">
    <div class="s-how__pin">
      <h2 id="titulo-como" class="display rv-lines">${lines(['Cómo *empezar*'])}</h2>
      <p class="s-how__count" aria-hidden="true"><span id="paso-actual">1</span><small>de ${STEPS.length}</small></p>
    </div>
    <ol class="steps">
      ${STEPS.map(([t, d], i) => `<li class="step" data-step="${i + 1}"><span class="step__n" aria-hidden="true">${i + 1}</span><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></li>`).join('')}
    </ol>
  </div>
  <div class="wrap s-how__resale">
    <div>
      <h3 class="subhead rv">Licencia de reventa</h3>
      <p class="rv">Cada plan incluye una licencia según su nivel. Registrar una venta no equivale a un pago, y las condiciones y comisiones aún están por definir: consúltalas antes de comprar. La licencia no garantiza ingresos.</p>
      <table class="matrix rv">
        <caption class="sr-only">Paquetes que puede revender cada nivel</caption>
        <thead><tr><th scope="col">Tu nivel</th><th scope="col">Puedes revender</th></tr></thead>
        <tbody>${state.programs.map((p) => `<tr><th scope="row">${esc(p.name)}</th><td>${esc(p.resale)}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <div>
      <h3 class="subhead rv">Subir de nivel</h3>
      <p class="rv">Pagas la diferencia. Conservas tu acceso actual y el nuevo se activa cuando se comprueba el pago.</p>
      <table class="matrix rv">
        <caption class="sr-only">Diferencia a pagar por actualización</caption>
        <thead><tr><th scope="col">Cambio</th><th scope="col">Diferencia</th></tr></thead>
        <tbody>
          ${[[1, 2], [2, 3], [1, 3]].map(([a, b]) => {
            const [from, to] = [state.programs[a - 1], state.programs[b - 1]];
            return `<tr><th scope="row">${from.name} a ${to.name}</th><td>${USD(to.priceCents - from.priceCents)}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
      <p class="rv">${waBtn('Consultar una actualización', whatsappMessages.upgrade(), 'btn--text')}</p>
    </div>
  </div>
</section>`;

function initHow(root) {
  const out = root.querySelector('#paso-actual');
  const steps = root.querySelectorAll('.step');
  if (!out || !('IntersectionObserver' in window)) return () => {};
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      e.target.classList.toggle('is-active', e.isIntersecting);
      if (e.isIntersecting) out.textContent = e.target.dataset.step;
    }
  }, { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach((s) => io.observe(s));
  return () => io.disconnect();
}

/* ---------- Glosario ---------- */
const glossarySection = () => `
<section class="s-glossary" aria-labelledby="titulo-glosario">
  <div class="wrap">
    <h2 id="titulo-glosario" class="display rv-lines">${lines(['Palabras que', '*vas a escuchar*'])}</h2>
    <p class="lede rv">Un pequeño glosario gratuito para entender el marketing digital antes de elegir un curso.</p>
    <dl class="glossary">
      ${glossary.map(([t, d], i) => `<div class="rv" style="--d:${(i % 3) * 90}ms"><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}
    </dl>
  </div>
</section>`;

/* ---------- Preguntas ---------- */
const faqSection = () => `
<section class="s-faq" id="preguntas-frecuentes" aria-labelledby="titulo-preguntas">
  <div class="wrap s-faq__grid">
    <h2 id="titulo-preguntas" class="display rv-lines">${lines(['Preguntas', '*frecuentes*'])}</h2>
    <div class="accordion">
      ${faqs.map((f, i) => `
      <div class="acc">
        <h3><button type="button" id="q-${i}" aria-expanded="false" aria-controls="a-${i}"><span>${esc(f.q)}</span><i aria-hidden="true"></i></button></h3>
        <div class="acc__body" id="a-${i}" role="region" aria-labelledby="q-${i}"><div><p>${esc(f.a)}</p></div></div>
      </div>`).join('')}
    </div>
  </div>
</section>`;

function initFaq(root) {
  root.querySelectorAll('.acc button').forEach((b) => b.addEventListener('click', () => {
    const open = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', open);
    b.closest('.acc').classList.toggle('is-open', open);
  }));
}

/* ---------- Redes y tarjetas ---------- */
const SOCIAL_ICON = {
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor"/>',
  tiktok: '<path fill="currentColor" d="M16.6 3c.3 2.2 1.6 3.9 3.9 4.2v2.9c-1.5 0-2.8-.4-3.9-1.2v6.3c0 3.5-2.6 5.8-5.7 5.8-3.2 0-5.6-2.5-5.6-5.6 0-3.4 2.9-6 6.5-5.5v3c-1.8-.4-3.5.8-3.5 2.5 0 1.5 1.1 2.6 2.6 2.6 1.6 0 2.7-1.1 2.7-3V3h3Z"/>',
  facebook: '<path fill="currentColor" d="M13.6 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.3-1.5 1.6-1.5h1.6V3.6c-.8-.1-1.6-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.3H7.7V13h2.7v8h3.2Z"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="none" stroke="currentColor" stroke-width="1.7"/><path fill="currentColor" d="M10.2 9.2v5.6l4.8-2.8-4.8-2.8Z"/>',
};
const icon = (id) => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${SOCIAL_ICON[id]}</svg>`;
export const socialList = () => `<ul class="socials" aria-label="Redes sociales">${socials.map((s) => `<li>${s.url
  ? `<a class="social" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(s.name)}">${icon(s.id)}</a>`
  : `<span class="social social--soon" tabindex="0" role="img" aria-label="${esc(s.name)}, próximamente" data-soon="${esc(s.name)}: próximamente">${icon(s.id)}</span>`}</li>`).join('')}</ul>`;

const CARD = {
  visa: ['Visa', '<svg viewBox="0 0 52 20" width="46" height="18" aria-hidden="true"><text x="26" y="17" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" font-style="italic" fill="#1A1F71">VISA</text></svg>'],
  mastercard: ['Mastercard', '<svg viewBox="0 0 40 26" width="40" height="26" aria-hidden="true"><circle cx="14" cy="13" r="11" fill="#EB001B"/><circle cx="26" cy="13" r="11" fill="#F79E1B"/><path fill="#FF5F00" d="M20 4.1a11 11 0 0 1 0 17.8 11 11 0 0 1 0-17.8Z"/></svg>'],
  amex: ['American Express', '<svg viewBox="0 0 56 30" width="54" height="30" aria-hidden="true"><rect width="56" height="30" rx="3" fill="#2E77BC"/><text x="28" y="20" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#fff">AMEX</text></svg>'],
  diners: ['Diners Club', '<svg viewBox="0 0 30 30" width="30" height="30" aria-hidden="true"><circle cx="15" cy="15" r="14" fill="#0079BE"/><circle cx="15" cy="15" r="9.5" fill="#fff"/><path fill="#0079BE" d="M13 8.4v13.2a7 7 0 0 1 0-13.2Zm4 0a7 7 0 0 1 0 13.2V8.4Z"/></svg>'],
};
export const cardBadge = (id) => `<span class="card-badge" role="img" aria-label="${CARD[id][0]}">${CARD[id][1]}</span>`;
const cardList = () => `<ul class="cards" aria-label="Tarjetas aceptadas">${acceptedCards.map((c, i) => `<li style="--i:${i}">${cardBadge(c)}</li>`).join('')}</ul>`;
const PAY_NOTE = payments.card.enabled
  ? 'Pagas con tarjeta en el checkout seguro del proveedor, o por WhatsApp con Yape o Plin. Esta web no guarda los datos de tu tarjeta.'
  : 'El pago con tarjeta estará disponible cuando se conecte la pasarela. Mientras tanto, puedes pagar por WhatsApp con Yape o Plin.';

/* ---------- Contacto ---------- */
const field = (id, label, input, required = true) => `
  <div class="field">
    <label for="${id}">${label}${required ? '' : ' <small>(opcional)</small>'}</label>
    ${input}
    <p class="field__error" id="${id}-error"></p>
  </div>`;
export { field };

const contactSection = () => `
<section class="s-contact" id="contacto" aria-labelledby="titulo-contacto">
  <div class="wrap s-contact__grid">
    <div>
      <h2 id="titulo-contacto" class="display rv-lines">${lines(['*Hablemos.*'])}</h2>
      <p class="lede rv">La forma más rápida de resolver tu duda es por WhatsApp.</p>
      <a class="wa-big rv" href="${esc(wa(whatsappMessages.general()))}" target="_blank" rel="noopener noreferrer">${esc(whatsapp.display)}</a>
      <div class="contact-info rv">
        <h3>Para responderte mejor, cuéntanos</h3>
        <ul class="tips">${contactTips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <h3>Síguenos</h3>
        ${socialList()}
        <h3>Tarjetas que aceptamos</h3>
        ${cardList()}
        <p class="cards-note">${esc(PAY_NOTE)}</p>
      </div>
    </div>
    <form class="form rv" id="form-contacto" novalidate>
      ${field('c-name', 'Nombre', '<input id="c-name" name="name" autocomplete="name" required>')}
      ${field('c-email', 'Correo electrónico', '<input id="c-email" name="email" type="email" autocomplete="email" required>')}
      ${field('c-phone', 'Teléfono', '<input id="c-phone" name="phone" type="tel" autocomplete="tel">', false)}
      ${field('c-message', 'Mensaje', '<textarea id="c-message" name="message" rows="4" required></textarea>')}
      <p class="form-status" role="alert"></p>
      <button class="btn btn--gold" type="submit"><span class="btn__in">Enviar mensaje</span></button>
      <p class="note">Este formulario envía tus datos a nuestro servidor. No abre WhatsApp.</p>
    </form>
  </div>
</section>`;

function initContact(root) {
  const form = root.querySelector('#form-contacto');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b = form.querySelector('button[type=submit]'); b.disabled = true;
    fieldError(form, {});
    try {
      await api('/api/contact', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      form.reset();
      toast(state.demo ? 'Mensaje guardado en la demostración. Aparece en Administración.' : 'Mensaje enviado.');
    } catch (err) { fieldError(form, err); }
    b.disabled = false;
  });
}

/* ---------- Montaje ---------- */
export function renderHome(main) {
  main.innerHTML = hero() + forSection() + learn() + programsSection() + howSection() + glossarySection() + faqSection() + contactSection();
  const stops = [
    initSilk(main.querySelector('.s-hero__silk')),
    initHero(main),
    initThread(main), initReveals(main), initHow(main), initTilt(main), initWordLight(main), initCounters(main), initRail(main),
  ];
  initLearn(main); initSyllabus(main); initFaq(main); initContact(main);
  // Sin requestAnimationFrame: en una pestaña oculta no se dispara y el contenido quedaría sin mostrar.
  const heroEl = main.querySelector('.s-hero');
  void heroEl.offsetWidth;
  heroEl.classList.add('is-in');
  return () => stops.forEach((s) => s());
}

export function renderProgramsPage(main) {
  main.innerHTML = `<div class="page-top"></div>${programsSection('h1')}`;
  initSyllabus(main);
  const stops = [initReveals(main), initTilt(main), initCounters(main)];
  return () => stops.forEach((s) => s());
}

export function renderProgram(main, slug) {
  const p = state.programs.find((x) => x.slug === slug);
  if (!p) return null;
  const others = state.programs.filter((x) => x !== p);
  main.innerHTML = `
  <section class="s-programs s-program">
    <div class="wrap s-program__grid">
      <div>
        <p class="crumb"><a class="link" href="/#cursos-y-planes">Cursos y planes</a></p>
        <h1 class="display rv-lines">${lines([`*${p.name}*`])}</h1>
        <p class="tier__price tier__price--xl rv">${USD(p.priceCents)}</p>
        <p class="tier__once rv">Pago único</p>
        <p class="tier__level rv">${esc(p.level)}</p>
        <p class="lede rv">${esc(p.tagline)}</p>
        <div class="hero-actions rv">
          ${btn('Pagar con tarjeta en la web', `href="${buyHref(p, 'web')}"`)}
          ${btn('Comprar por WhatsApp con Yape o Plin', `href="${buyHref(p, 'whatsapp')}"`, 'btn--line')}
          ${waBtn('Consultar por WhatsApp', whatsappMessages.plan(p), 'btn--text')}
        </div>
      </div>
      <div>
        <h2 class="subhead">Qué incluye</h2>
        <ul class="tier__list tier__list--open">${p.features.map((f) => `<li>${check}<span>${esc(f)}</span></li>`).join('')}</ul>
        <h2 class="subhead">Tema por tema</h2>
        ${syllabusList(p)}
        <h2 class="subhead">Reventa incluida según licencia</h2>
        <p>${esc(p.resale)}. Lee la <a class="link" href="/legal/licencia-reventa">licencia de reventa</a> antes de comprar.</p>
        <h2 class="subhead">Otros niveles</h2>
        <ul class="other-plans">${others.map((o) => `<li><a class="link" href="/programas/${o.slug}">${esc(o.name)}, ${USD(o.priceCents)}</a></li>`).join('')}</ul>
      </div>
    </div>
  </section>`;
  return initReveals(main);
}

function initCardSheen(foot) {
  const box = foot.querySelector('.site-footer');
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { box.classList.add('in'); io.disconnect(); } }, { threshold: 0.2 });
  io.observe(box);
}

const LEGAL_FOOT = [
  ['/legal/privacidad', 'Política de privacidad'], ['/legal/terminos', 'Términos y condiciones'],
  ['/legal/devoluciones', 'Política de devoluciones'], ['/legal/licencia-reventa', 'Licencia de reventa'],
  ['/legal/cookies', 'Política de cookies'], ['/legal/aviso-legal', 'Aviso legal'],
];

export function renderFooter(foot) {
  foot.innerHTML = `
  <div class="site-footer">
    <div class="wrap footer-grid">
      <a href="/" aria-label="Legado Digital, ir al inicio"><img class="site-footer__logo" src="${brand.logo.full720}" width="1254" height="1254" loading="lazy" alt="${esc(brand.logo.alt)}"></a>
      <nav class="footer-col" aria-label="Pie de página"><h2>Explora</h2><ul>
        <li><a class="link" href="/#que-aprenderas">Qué aprenderás</a></li>
        <li><a class="link" href="/#cursos-y-planes">Cursos y planes</a></li>
        <li><a class="link" href="/#como-empezar">Cómo empezar</a></li>
        <li><a class="link" href="/#preguntas-frecuentes">Preguntas frecuentes</a></li>
        <li><a class="link" href="/#contacto">Contacto</a></li>
      </ul></nav>
      <nav class="footer-col" aria-label="Información legal"><h2>Legal</h2><ul>
        ${LEGAL_FOOT.map(([href, label]) => `<li><a class="link" href="${href}">${label}</a></li>`).join('')}
      </ul></nav>
      <div class="footer-col">
        <h2>Síguenos</h2>
        ${socialList()}
        <h2>Tarjetas que aceptamos</h2>
        ${cardList()}
        <a class="footer-claims" href="/libro-de-reclamaciones"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm3 13h11M9 8h6M9 11h6"/></svg>Libro de reclamaciones</a>
      </div>
    </div>
    <div class="wrap footer-bottom">
      <p>© ${new Date().getFullYear()} Legado Digital. Todos los derechos reservados.</p>
      <p><a class="link" href="${esc(wa(whatsappMessages.general()))}" target="_blank" rel="noopener noreferrer">WhatsApp ${esc(whatsapp.display)}</a></p>
      ${state.demo ? '<p>Versión de demostración: las cuentas, operaciones y pagos son ficticios.</p>' : ''}
    </div>
  </div>`;
  initCardSheen(foot);
}
