// Experiencia pública: portada, apartados y demostraciones educativas.
import { brand, comparison, faqs, projects, story, USD, whatsapp, whatsappLink, whatsappMessages, pending } from '../shared/site.config.mjs';
import { api, currentRef, esc, fieldError, state, toast } from './core.js';
import { initLogoLight, initParallax, initReveals, initSilk, initThread } from './effects.js';

const wa = (msg) => whatsappLink(msg, currentRef());
export const btn = (label, attrs = '', cls = 'btn--gold') => `<a class="btn ${cls}" ${attrs}><span class="btn__in">${esc(label)}</span></a>`;
const waBtn = (label, msg, cls = 'btn--ghost') => btn(label, `href="${esc(wa(msg))}" target="_blank" rel="noopener noreferrer"`, cls);
const founder = esc(brand.founderName);

function lines(text) {
  return text.map((l, i) => `<span class="line"><span style="--i:${i}">${esc(l)}</span></span>`).join(' ');
}

/* ---------- Inicio ---------- */
const hero = () => `
<section class="s-hero" id="inicio" aria-labelledby="titulo-inicio">
  <canvas class="s-hero__silk" aria-hidden="true"></canvas>
  <div class="s-hero__veil" aria-hidden="true"></div>
  <div class="s-hero__grid">
    <div class="s-hero__logo" id="logo-hero">
      <img src="${brand.logo.full720}" srcset="${brand.logo.full720} 720w, ${brand.logo.full} 1254w" sizes="(min-width: 1024px) 44vw, 72vw" width="1254" height="1254" alt="${esc(brand.logo.alt)}" fetchpriority="high">
      <span class="s-hero__sheen" aria-hidden="true"></span>
    </div>
    <div class="s-hero__copy">
      <h1 id="titulo-inicio" class="hero-title">${lines(['Construye tu marca.', 'Desarrolla tus', 'habilidades digitales.'])}</h1>
      <p class="hero-sub">Formación en marca personal, ventas digitales, WhatsApp e inteligencia artificial, para desarrollar una presencia digital con propósito.</p>
      <div class="hero-actions">
        ${btn('Explorar programas', 'href="/#programas"')}
        ${waBtn('Hablar por WhatsApp', whatsappMessages.general())}
      </div>
    </div>
  </div>
</section>`;

/* ---------- Nuestra historia ---------- */
const storySection = () => `
<section class="s-story" id="nuestra-historia" aria-labelledby="titulo-historia">
  <div class="wrap s-story__grid">
    <figure class="portrait rv">
      ${story.portrait
        ? `<img src="${esc(story.portrait)}" alt="${founder}" loading="lazy" data-parallax="28">`
        : `<div class="portrait__empty" data-parallax="28" aria-hidden="true"></div>
           <figcaption><span class="tag">Por confirmar</span> Aquí irá el retrato real de ${founder}.</figcaption>`}
    </figure>
    <div class="s-story__text">
      <h2 id="titulo-historia" class="display rv-lines">${lines(['Detrás de la marca', 'hay una persona.'])}</h2>
      <p class="lede rv">${esc(story.intro)}</p>
      <blockquote class="quote rv">
        ${story.quote ? `<p>${esc(story.quote)}</p>` : `<p class="quote__empty">Aquí irá una cita real de ${founder}, con sus propias palabras.</p><span class="tag">Por confirmar</span>`}
      </blockquote>
    </div>
  </div>
  <ol class="wrap timeline" aria-label="Línea temporal">
    ${story.timeline.map((t, i) => `
      <li class="timeline__item rv" style="--d:${i * 90}ms">
        <h3>${esc(t.title)}</h3>
        ${t.text ? `<p>${esc(t.text)}</p>` : `<p class="muted">${esc(t.hint)}</p><span class="tag">Por confirmar</span>`}
      </li>`).join('')}
  </ol>
</section>`;

/* ---------- Qué aprenderás ---------- */
const MODULES = [
  { id: 'marca', title: 'Marca personal', text: 'Define a quién ayudas y cómo decirlo en una frase que cualquiera pueda repetir.', demo: () => `
    <div class="demo-grid">
      <div class="field"><label for="d-quien">A quién ayudas</label><input id="d-quien" value="emprendedoras de repostería"></div>
      <div class="field"><label for="d-que">Qué consiguen contigo</label><input id="d-que" value="vender sus pedidos por WhatsApp"></div>
    </div>
    <div class="phone-line" aria-live="polite">
      <span class="phone-line__label">Así se leería en tu perfil</span>
      <p id="d-frase"></p>
    </div>` },
  { id: 'identidad', title: 'Identidad visual', text: 'Elige colores que se lean bien. Prueba estas combinaciones y mira su contraste real.', demo: () => `
    <div class="swatches" role="radiogroup" aria-label="Combinación de colores">
      ${[['#F4ECDD', '#121216', 'Marfil sobre carbón'], ['#121216', '#D9B875', 'Carbón sobre dorado'], ['#D9B875', '#F4ECDD', 'Dorado sobre marfil'], ['#F4ECDD', '#1F3D5C', 'Marfil sobre azul']]
        .map(([fg, bg, name], i) => `<button type="button" role="radio" aria-checked="${i === 0}" class="swatch" data-fg="${fg}" data-bg="${bg}" aria-label="${name}" style="color:${fg};background:${bg}">Aa</button>`).join('')}
    </div>
    <div class="id-preview" id="d-id-preview"><strong>Tu nombre</strong><span>Tu especialidad, en una línea</span></div>
    <p class="contrast" id="d-contrast" aria-live="polite"></p>` },
  { id: 'whatsapp', title: 'Captación por WhatsApp', text: 'Un perfil ordenado responde antes de que te pregunten. Activa cada parte y compara.', demo: () => `
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
  { id: 'ventas', title: 'Ventas', text: 'Una conversación comercial tiene etapas. Recorre un ejemplo de principio a fin.', demo: () => `
    <div class="stages" role="group" aria-label="Etapas de la conversación">
      ${['Primer contacto', 'Necesidad', 'Propuesta', 'Seguimiento'].map((s, i) => `<button type="button" class="stage" data-stage="${i}" aria-pressed="${i === 0}">${s}</button>`).join('')}
    </div>
    <div class="bubble" id="d-bubble" aria-live="polite"></div>
    <p class="note">Mensaje de ejemplo. Adáptalo a tu forma de hablar.</p>` },
  { id: 'ia', title: 'Inteligencia artificial', text: 'Pide a ChatGPT un borrador útil dándole contexto. Arma tu instrucción y cópiala.', demo: () => `
    <div class="demo-grid">
      <div class="field"><label for="d-tarea">Qué necesitas</label><select id="d-tarea">
        <option value="tres ideas de publicaciones">Ideas de publicaciones</option>
        <option value="un mensaje de seguimiento por WhatsApp">Mensaje de seguimiento</option>
        <option value="una descripción breve de mi servicio">Descripción de servicio</option>
      </select></div>
      <div class="field"><label for="d-tono">Con qué tono</label><select id="d-tono">
        <option value="cercano">Cercano</option><option value="profesional">Profesional</option><option value="directo">Directo</option>
      </select></div>
    </div>
    <div class="prompt"><p id="d-prompt"></p><button class="btn btn--ghost btn--small" type="button" id="d-copiar"><span class="btn__in">Copiar instrucción</span></button></div>
    <p class="note">Revisa siempre el resultado antes de enviarlo a un cliente.</p>` },
];

const learn = () => `
<section class="s-learn" id="que-aprenderas" aria-labelledby="titulo-aprender">
  <div class="wrap">
    <h2 id="titulo-aprender" class="display rv-lines">${lines(['Qué aprenderás,', 'probándolo aquí.'])}</h2>
    <div class="learn">
      <div class="learn__tabs" role="tablist" aria-label="Módulos" aria-orientation="vertical">
        ${MODULES.map((m, i) => `<button role="tab" type="button" id="tab-${m.id}" aria-controls="panel-${m.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(m.title)}</button>`).join('')}
      </div>
      <div class="learn__panels">
        ${MODULES.map((m, i) => `<div role="tabpanel" id="panel-${m.id}" aria-labelledby="tab-${m.id}" tabindex="0" ${i === 0 ? '' : 'hidden'}>
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

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

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
  const frase = () => { $('#d-frase').textContent = `Ayudo a ${$('#d-quien').value || '…'} a ${$('#d-que').value || '…'}.`; };
  $('#d-quien').addEventListener('input', frase); $('#d-que').addEventListener('input', frase); frase();

  const swatches = [...root.querySelectorAll('.swatch')];
  const paint = (s) => {
    swatches.forEach((x) => x.setAttribute('aria-checked', x === s));
    const { fg, bg } = s.dataset;
    const p = $('#d-id-preview'); p.style.color = fg; p.style.background = bg;
    const r = contrast(fg, bg);
    $('#d-contrast').textContent = `Contraste ${r.toFixed(1)} a 1. ${r >= 4.5 ? 'Se lee bien en texto normal.' : r >= 3 ? 'Úsalo solo en títulos grandes.' : 'Cuesta leerlo: elige otra combinación.'}`;
  };
  swatches.forEach((s, i) => {
    s.addEventListener('click', () => paint(s));
    s.tabIndex = i === 0 ? 0 : -1;
    s.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      const n = swatches[(i + d + swatches.length) % swatches.length];
      swatches.forEach((x) => { x.tabIndex = x === n ? 0 : -1; }); n.focus(); paint(n);
    });
  });
  paint(swatches[0]);

  const parts = root.querySelectorAll('[data-part]');
  const syncParts = () => parts.forEach((c) => root.querySelector(`[data-show="${c.dataset.part}"]`).classList.toggle('is-off', !c.checked));
  parts.forEach((c) => c.addEventListener('change', syncParts)); syncParts();

  const stages = [...root.querySelectorAll('.stage')];
  const showStage = (b) => {
    stages.forEach((s) => s.setAttribute('aria-pressed', s === b));
    const bubble = $('#d-bubble');
    bubble.textContent = STAGE_TEXT[b.dataset.stage];
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
  };
  stages.forEach((s) => s.addEventListener('click', () => showStage(s))); showStage(stages[0]);

  const prompt = () => { $('#d-prompt').textContent = `Tengo un negocio de [describe tu negocio] y mis clientes son [describe a quién ayudas]. Prepara ${$('#d-tarea').value} con un tono ${$('#d-tono').value}. Hazme antes las preguntas que necesites para no inventar datos.`; };
  $('#d-tarea').addEventListener('change', prompt); $('#d-tono').addEventListener('change', prompt); prompt();
  $('#d-copiar').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#d-prompt').textContent); toast('Instrucción copiada.'); }
    catch { toast('No se pudo copiar. Selecciona el texto y cópialo a mano.', 'error'); }
  });
}

/* ---------- Programas ---------- */
const check = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2.5 8.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

export function planActionAttrs(p) {
  return `href="/registro?plan=${p.slug}" data-choose="${p.slug}"`;
}

const plan = (p, i) => `
<article class="tier tier--${p.slug} rv" style="--d:${i * 110}ms" aria-labelledby="plan-${p.slug}">
  <div class="tier__head">
    <h3 id="plan-${p.slug}">${esc(p.name)}</h3>
    <p class="tier__price">${USD(p.priceCents)}</p>
    <p class="tier__once">Pago único</p>
  </div>
  <p class="tier__tagline">${esc(p.tagline)}</p>
  ${p.highlight ? `<p class="tier__flag">${esc(p.highlight)}</p>` : ''}
  <ul class="tier__list">${p.features.map((f) => `<li>${check}<span>${esc(f)}</span></li>`).join('')}</ul>
  ${p.draftNote ? `<p class="note">${esc(p.draftNote)}</p>` : ''}
  <div class="tier__actions">
    ${btn(p.action, planActionAttrs(p), p.rank === 2 ? 'btn--gold' : 'btn--line')}
    ${waBtn('Consultar por WhatsApp', whatsappMessages.plan(p), 'btn--text')}
    <a class="link" href="/programas/${p.slug}">Ver el programa ${esc(p.name)}</a>
  </div>
</article>`;

export const comparisonTable = () => `
<div class="compare rv">
  <table>
    <caption>Comparación de acceso y permisos</caption>
    <thead><tr><td></td>${state.programs.map((p) => `<th scope="col">${esc(p.name)}</th>`).join('')}</tr></thead>
    <tbody>
      <tr><th scope="row">Precio de pago único</th>${state.programs.map((p) => `<td data-plan="${esc(p.name)}">${USD(p.priceCents)}</td>`).join('')}</tr>
      ${comparison.map(([label, ...cells]) => `<tr><th scope="row">${esc(label)}</th>${cells.map((c, i) => `<td data-plan="${esc(state.programs[i].name)}" class="${c === 'No' ? 'is-no' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>
</div>`;

export const programsSection = (headingLevel = 'h2') => `
<section class="s-programs" id="programas" aria-labelledby="titulo-programas">
  <div class="wrap">
    <div class="s-programs__intro">
      <${headingLevel} id="titulo-programas" class="display rv-lines">${lines(['Tres programas.', 'Cada uno suma', 'al anterior.'])}</${headingLevel}>
      <p class="lede rv">Pagas una sola vez. Puedes empezar por uno y subir más adelante pagando solo la diferencia.</p>
    </div>
    <div class="tiers">${state.programs.map(plan).join('')}</div>
    ${comparisonTable()}
  </div>
</section>`;

/* ---------- Cómo funciona ---------- */
const STEPS = [
  ['Elige tu programa', 'Compara los tres y quédate con el que te sirve hoy. Puedes consultarnos por WhatsApp sin registrarte.'],
  ['Registra tus datos', 'Crea tu cuenta. Tu elección se conserva y aparece como una operación pendiente.'],
  ['Consulta el pago', 'Te indicamos cómo pagar por WhatsApp. Después, puedes subir tu comprobante a la operación.'],
  ['Espera la validación', 'Un administrador verifica el pago y aprueba o rechaza la operación, con una explicación.'],
  ['Accede a tu nivel', 'Tu nivel se activa y entras a tus contenidos desde Mi cuenta. Si un curso aún no está cargado, lo verás indicado.'],
];
const howSection = () => `
<section class="s-how" id="como-funciona" aria-labelledby="titulo-como">
  <div class="wrap s-how__grid">
    <div class="s-how__pin">
      <h2 id="titulo-como" class="display rv-lines">${lines(['Cómo funciona'])}</h2>
      <p class="s-how__count" aria-hidden="true"><span id="paso-actual">1</span><small>de ${STEPS.length}</small></p>
    </div>
    <ol class="steps">
      ${STEPS.map(([t, d], i) => `<li class="step" data-step="${i + 1}"><span class="step__n" aria-hidden="true">${i + 1}</span><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></li>`).join('')}
    </ol>
  </div>
  <div class="wrap s-how__resale">
    <div>
      <h3 class="subhead rv">La opción de reventa</h3>
      <p class="rv">Con tu compra validada recibes un enlace personal. Tu nivel decide qué programas puedes revender. Registrar una venta no equivale a un pago: las condiciones de comisión aún están por definir.</p>
      <table class="matrix rv">
        <caption class="sr-only">Programas que puede revender cada nivel</caption>
        <thead><tr><th scope="col">Tu nivel</th><th scope="col">Puedes revender</th></tr></thead>
        <tbody>
          <tr><th scope="row">Esencial</th><td>Esencial</td></tr>
          <tr><th scope="row">Impulso</th><td>Esencial e Impulso</td></tr>
          <tr><th scope="row">Avanzado</th><td>Esencial, Impulso y Avanzado</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <h3 class="subhead rv">Subir de nivel</h3>
      <p class="rv">Pagas la diferencia. Conservas tu acceso actual y el nuevo se activa cuando se valida el pago.</p>
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

/* ---------- Experiencias y proyectos ---------- */
const SCENES = {
  dusk: `<svg viewBox="0 0 1200 620" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="sc-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1414"/><stop offset=".62" stop-color="#2e3a2c"/><stop offset=".8" stop-color="#a98a53"/></linearGradient>
    <radialGradient id="sc-b"><stop offset="0" stop-color="#F0D69C" stop-opacity=".9"/><stop offset="1" stop-color="#F0D69C" stop-opacity="0"/></radialGradient></defs>
    <rect width="1200" height="620" fill="url(#sc-a)"/><circle cx="820" cy="400" r="260" fill="url(#sc-b)"/><circle cx="820" cy="400" r="44" fill="#F0D69C"/>
    <path d="M0 420C160 360 300 410 460 372S760 330 900 390 1120 420 1200 380V620H0Z" fill="#17231c"/>
    <path d="M0 500C220 450 400 520 640 470S1000 460 1200 500V620H0Z" fill="#0b1411"/></svg>`,
  ridge: `<svg viewBox="0 0 700 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="sc-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#08171a"/><stop offset="1" stop-color="#23413f"/></linearGradient></defs>
    <rect width="700" height="900" fill="url(#sc-c)"/>
    <path d="M0 620L180 360 310 520 470 250 700 600V900H0Z" fill="#132b2a"/><path d="M470 250l40 62-30-12-26 30-22-24Z" fill="#D9B875" opacity=".7"/>
    <path d="M0 760L220 560 400 720 560 580 700 700V900H0Z" fill="#0a1a19"/></svg>`,
  tide: `<svg viewBox="0 0 900 620" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="sc-d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#101a10"/><stop offset="1" stop-color="#34401f"/></linearGradient></defs>
    <rect width="900" height="620" fill="url(#sc-d)"/>
    <g fill="none" stroke="#D9B875" stroke-opacity=".45"><path d="M-20 420C160 340 300 490 480 400S760 330 920 410"/><path d="M-20 460C160 380 300 530 480 440S760 370 920 450"/><path d="M-20 500C160 420 300 570 480 480S760 410 920 490"/><path d="M-20 540C160 460 300 610 480 520S760 450 920 530"/></g>
    <g fill="#F0D69C"><circle cx="240" cy="190" r="4"/><circle cx="430" cy="130" r="4"/><circle cx="620" cy="200" r="4"/></g>
    <g fill="none" stroke="#F0D69C" stroke-opacity=".4"><path d="M240 190L430 130 620 200"/></g></svg>`,
};
const projectsSection = () => `
<section class="s-projects" id="experiencias-y-proyectos" aria-labelledby="titulo-proyectos">
  <div class="wrap">
    <h2 id="titulo-proyectos" class="display rv-lines">${lines(['Experiencias', 'y proyectos'])}</h2>
    <p class="lede rv">Lo vivido fuera del aula también enseña. Este espacio mostrará proyectos reales y experiencias de ${founder}.</p>
    <div class="gallery">
      ${projects.map((p) => `
      <figure class="scene scene--${p.size} rv">
        <div class="scene__art" data-parallax="26">${p.media ? `<img src="${esc(p.media)}" alt="${esc(p.title)}" loading="lazy">` : SCENES[p.scene]}</div>
        <figcaption><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p>${p.confirmed ? '' : '<span class="tag">Ilustración: pendiente de foto real</span>'}</figcaption>
      </figure>`).join('')}
    </div>
  </div>
</section>`;

/* ---------- Preguntas ---------- */
const faqSection = () => `
<section class="s-faq" id="preguntas-frecuentes" aria-labelledby="titulo-preguntas">
  <div class="wrap s-faq__grid">
    <h2 id="titulo-preguntas" class="display rv-lines">${lines(['Preguntas', 'frecuentes'])}</h2>
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
      <h2 id="titulo-contacto" class="display rv-lines">${lines(['Hablemos.'])}</h2>
      <p class="lede rv">La forma más rápida de resolver tu duda es por WhatsApp.</p>
      <a class="wa-big rv" href="${esc(wa(whatsappMessages.general()))}" target="_blank" rel="noopener noreferrer">${esc(whatsapp.display)}</a>
      ${pending.socialLinks.length ? `<ul class="socials">${pending.socialLinks.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a></li>`).join('')}</ul>` : ''}
    </div>
    <form class="form rv" id="form-contacto"><p class="note">Prepara tu consulta y envíala por WhatsApp. Este formulario no guarda tus datos en la web.</p>
      ${field('c-name', 'Nombre', '<input id="c-name" name="name" autocomplete="name" required>')}
      ${field('c-email', 'Correo electrónico', '<input id="c-email" name="email" type="email" autocomplete="email" required>')}
      ${field('c-phone', 'Teléfono', '<input id="c-phone" name="phone" type="tel" autocomplete="tel">', false)}
      ${field('c-message', 'Mensaje', '<textarea id="c-message" name="message" rows="4" required></textarea>')}
      <p class="form-status" role="alert"></p>
      <button class="btn btn--gold" type="submit"><span class="btn__in">Continuar en WhatsApp</span></button>
    </form>
  </div>
</section>`;

function initContact(root) {
  const form = root.querySelector('#form-contacto');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form));
    const text = `Hola, soy ${data.name}. ${data.message}\nCorreo de contacto: ${data.email}${data.phone ? '\nTeléfono: ' + data.phone : ''}`;
    window.open(wa(text), '_blank', 'noopener,noreferrer');
  });
}

/* ---------- Montaje ---------- */
export function renderHome(main) {
  main.innerHTML = hero() + storySection() + learn() + programsSection() + howSection() + projectsSection() + faqSection() + contactSection();
  const stops = [
    initSilk(main.querySelector('.s-hero__silk')),
    initLogoLight(main.querySelector('#logo-hero')),
    initThread(main), initReveals(main), initParallax(main), initHow(main),
  ];
  initLearn(main); initFaq(main); initContact(main);
  // Sin requestAnimationFrame: en una pestaña oculta no se dispara y el contenido quedaría sin mostrar.
  const heroEl = main.querySelector('.s-hero');
  void heroEl.offsetWidth;
  heroEl.classList.add('is-in');
  return () => stops.forEach((s) => s());
}

export function renderProgramsPage(main) {
  main.innerHTML = `<div class="page-top"></div>${programsSection('h1')}`;
  const stop = initReveals(main);
  return stop;
}

export function renderProgram(main, slug) {
  const p = state.programs.find((x) => x.slug === slug);
  if (!p) return null;
  const others = state.programs.filter((x) => x !== p);
  const resale = { 1: 'Esencial', 2: 'Esencial e Impulso', 3: 'Esencial, Impulso y Avanzado' }[p.rank];
  main.innerHTML = `
  <section class="s-programs s-program">
    <div class="wrap s-program__grid">
      <div>
        <p class="crumb"><a class="link" href="/#programas">Programas</a></p>
        <h1 class="display rv-lines">${lines([p.name])}</h1>
        <p class="tier__price tier__price--xl rv">${USD(p.priceCents)}</p>
        <p class="tier__once rv">Pago único</p>
        <p class="lede rv">${esc(p.lead)}</p>
        <div class="hero-actions rv">
          ${btn(p.action, planActionAttrs(p))}
          ${waBtn('Consultar por WhatsApp', whatsappMessages.plan(p))}
        </div>
      </div>
      <div>
        <h2 class="subhead">Qué incluye</h2>
        <ul class="tier__list tier__list--open">${p.features.map((f) => `<li>${check}<span>${esc(f)}</span></li>`).join('')}</ul>
        ${p.draftNote ? `<p class="note">${esc(p.draftNote)}</p>` : ''}
        <h2 class="subhead">Reventa habilitable</h2>
        <p>${esc(resale)}, conforme a las condiciones aprobadas.</p>
        <h2 class="subhead">Otros programas</h2>
        <ul class="other-plans">${others.map((o) => `<li><a class="link" href="/programas/${o.slug}">${esc(o.name)}, ${USD(o.priceCents)}</a></li>`).join('')}</ul>
      </div>
    </div>
  </section>`;
  return initReveals(main);
}

export function renderFooter(foot) {
  const { terms, privacy } = pending.legalPages;
  foot.innerHTML = `
  <div class="site-footer">
    <div class="wrap site-footer__grid">
      <a href="/" aria-label="Legado Digital, ir al inicio"><img class="site-footer__logo" src="${brand.logo.full720}" width="1254" height="1254" loading="lazy" alt="${esc(brand.logo.alt)}"></a>
      <nav aria-label="Pie de página"><ul>
        <li><a class="link" href="/#programas">Programas</a></li>
        <li><a class="link" href="/#preguntas-frecuentes">Preguntas frecuentes</a></li>
        <li><a class="link" href="/#contacto">Contacto</a></li>
        ${terms ? `<li><a class="link" href="${esc(terms)}">Condiciones</a></li>` : ''}
        ${privacy ? `<li><a class="link" href="${esc(privacy)}">Privacidad</a></li>` : ''}
      </ul></nav>
      <p class="site-footer__wa"><a class="link" href="${esc(wa(whatsappMessages.general()))}" target="_blank" rel="noopener noreferrer">WhatsApp ${esc(whatsapp.display)}</a></p>
    </div>
    ${state.demo ? '<p class="site-footer__demo">Vista previa pública. El área de alumnos es una demostración; las consultas se atienden por WhatsApp.</p>' : ''}
  </div>`;
}
