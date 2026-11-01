// Movimiento decorativo. Todo se apaga con movimiento reducido y nada intercepta clics.
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---------- Cursor, aro y onda de clic ---------- */
export function initPointer() {
  if (!reduced()) initRipple();
  if (!finePointer() || reduced()) return;
  const dot = document.createElement('div'); dot.className = 'cursor-dot';
  const ring = document.createElement('div'); ring.className = 'cursor-ring';
  const label = document.createElement('span'); ring.append(label);
  document.body.append(dot, ring);
  document.documentElement.classList.add('has-cursor');

  let x = -100, y = -100, rx = -100, ry = -100, raf = 0;
  const tick = () => {
    rx += (x - rx) * 0.2; ry += (y - ry) * 0.2;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
    raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.2 ? requestAnimationFrame(tick) : 0;
  };
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    dot.style.transform = `translate(${x}px, ${y}px)`;
    document.documentElement.classList.add('cursor-on');
    if (!raf) raf = requestAnimationFrame(tick);
    const t = e.target.closest?.('input, textarea, select, [contenteditable]');
    document.documentElement.classList.toggle('cursor-text', !!t);
    const hit = e.target.closest?.('a, button, summary, label, [role="tab"], [data-cursor]');
    ring.classList.toggle('is-hover', !!hit);
    const text = e.target.closest?.('[data-cursor]')?.dataset.cursor || '';
    if (label.textContent !== text) label.textContent = text;
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => document.documentElement.classList.remove('cursor-on'));

  // Magnetismo ligero sobre el contenido del botón: el área de clic no se mueve.
  addEventListener('pointermove', (e) => {
    const b = e.target.closest?.('.btn');
    document.querySelectorAll('.btn__in[style]').forEach((i) => { if (!b || i.parentElement !== b) i.removeAttribute('style'); });
    if (!b) return;
    const inner = b.querySelector('.btn__in');
    if (!inner) return;
    const r = b.getBoundingClientRect();
    inner.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.09}px, ${(e.clientY - r.top - r.height / 2) * 0.16}px)`;
  }, { passive: true });
}

function initRipple() {
  let live = 0;
  addEventListener('pointerdown', (e) => {
    if (live >= 5 || e.button !== 0) return;
    const el = document.createElement('span');
    el.className = 'click-ring';
    el.style.left = `${e.clientX}px`; el.style.top = `${e.clientY}px`;
    document.body.append(el); live++;
    const done = () => { if (el.isConnected) { el.remove(); live--; } };
    el.addEventListener('animationend', done, { once: true });
    setTimeout(done, 600);
  }, { passive: true });
}

/* ---------- Revelados ---------- */
export function initReveals(root) {
  const items = root.querySelectorAll('.rv, .rv-lines');
  if (reduced() || !('IntersectionObserver' in window)) { items.forEach((i) => i.classList.add('in')); return () => {}; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px' });
  items.forEach((i) => io.observe(i));
  return () => io.disconnect();
}

/* ---------- Seda dorada de la portada (WebGL) ---------- */
const FRAG = `precision mediump float;
uniform vec2 res; uniform float t; uniform vec2 m;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+vec2(11.,7.);a*=.5;}return v;}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*res)/res.y;
  vec2 p=uv*vec2(1.25,2.1)+m*.05;
  float s=t*.045;
  vec2 q=vec2(fbm(p+vec2(s,0.)),fbm(p+vec2(1.7,9.2)-s));
  vec2 r=vec2(fbm(p+2.6*q+vec2(1.7-s,9.2)),fbm(p+2.6*q+vec2(8.3,2.8+s)));
  float f=fbm(p+2.4*r);
  float fold=pow(1.-abs(2.*f-1.),7.);
  float soft=smoothstep(.25,.95,f);
  vec3 col=vec3(.031,.031,.035);
  col+=vec3(.20,.135,.05)*soft*.55;
  col+=vec3(.85,.72,.46)*fold*.42;
  col+=vec3(.94,.84,.61)*pow(fold,4.)*.35;
  float v=smoothstep(1.25,.25,length(uv*vec2(.8,1.1)));
  col*=mix(.35,1.,v);
  gl_FragColor=vec4(col,1.);
}`;

export function initSilk(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { canvas.remove(); return () => {}; }
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return () => {}; }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.bindAttribLocation(prog, 0, 'a');
  gl.vertexAttribPointer(gl.getAttribLocation(prog, 'a'), 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'res'), uT = gl.getUniformLocation(prog, 't'), uM = gl.getUniformLocation(prog, 'm');

  const size = () => {
    const scale = 0.55; // La textura es suave: media resolución basta y ahorra batería.
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  };
  let mx = 0, my = 0, tx = 0, ty = 0;
  const draw = (ms) => {
    mx += (tx - mx) * 0.04; my += (ty - my) * 0.04;
    gl.uniform1f(uT, ms / 1000 + 40);
    gl.uniform2f(uM, mx, my);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const ro = new ResizeObserver(() => { size(); if (reduced()) draw(0); });
  ro.observe(canvas);
  size();
  if (reduced()) { draw(0); return () => ro.disconnect(); }

  const onMove = (e) => { tx = e.clientX / innerWidth - 0.5; ty = 0.5 - e.clientY / innerHeight; };
  addEventListener('pointermove', onMove, { passive: true });
  let raf = 0, last = 0, visible = true;
  const loop = (ms) => {
    raf = requestAnimationFrame(loop);
    if (ms - last < 33) return;
    last = ms; draw(ms);
  };
  const sync = () => {
    cancelAnimationFrame(raf); raf = 0;
    if (visible && !document.hidden) raf = requestAnimationFrame(loop);
  };
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); });
  io.observe(canvas);
  document.addEventListener('visibilitychange', sync);
  sync();
  return () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', sync); };
}

/* ---------- El hilo: una línea dorada que une los apartados al bajar ---------- */
export function initThread(main) {
  const sections = [...main.querySelectorAll('section[id]')];
  if (sections.length < 3) return () => {};
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'thread'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<defs><linearGradient id="hilo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F0D69C"/><stop offset=".5" stop-color="#D9B875"/><stop offset="1" stop-color="#F0D69C"/></linearGradient></defs>
    <path class="thread__line" fill="none" stroke="url(#hilo)" stroke-width="1.2" vector-effect="non-scaling-stroke" pathLength="1"/>
    <circle class="thread__head" r="3.5" fill="#F0D69C"/>`;
  main.prepend(svg);
  const path = svg.querySelector('path'), head = svg.querySelector('circle');
  let length = 0;

  const build = () => {
    const W = main.clientWidth, H = main.scrollHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.height = `${H}px`;
    const m = Math.max(10, Math.min(W * 0.028, 44));
    const mainTop = main.getBoundingClientRect().top + scrollY;
    let side = W - m;
    let d = `M ${side} ${sections[0].offsetHeight * 0.82}`;
    sections.slice(1).forEach((s) => {
      const top = s.getBoundingClientRect().top + scrollY - mainTop;
      const next = side === m ? W - m : m;
      const span = Math.min(180, s.offsetHeight * 0.2);
      // Recta por el margen y cruce suave en la unión entre apartados.
      d += ` L ${side} ${top - span * 0.5} C ${side} ${top + span * 0.4}, ${next} ${top - span * 0.1}, ${next} ${top + span * 0.8}`;
      side = next;
    });
    d += ` L ${side} ${H - 40}`;
    path.setAttribute('d', d);
    length = path.getTotalLength();
    update();
  };
  const update = () => {
    const progress = Math.min(1, Math.max(0, (scrollY + innerHeight * 0.72 - sections[0].offsetHeight * 0.82) / (main.scrollHeight - sections[0].offsetHeight * 0.82)));
    path.style.strokeDashoffset = String(1 - progress);
    const pt = path.getPointAtLength(length * progress);
    head.setAttribute('cx', pt.x); head.setAttribute('cy', pt.y);
    head.style.opacity = progress > 0.002 && progress < 0.998 ? 1 : 0;
  };
  let pending = false;
  const onScroll = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; update(); });
  };
  build();
  const ro = new ResizeObserver(build);
  ro.observe(main);
  if (reduced()) { path.style.strokeDashoffset = '0'; head.remove(); return () => ro.disconnect(); }
  addEventListener('scroll', onScroll, { passive: true });
  return () => { ro.disconnect(); removeEventListener('scroll', onScroll); svg.remove(); };
}

/* ---------- Parallax discreto en fotografías ---------- */
export function initParallax(root) {
  const items = [...root.querySelectorAll('[data-parallax]')];
  if (reduced() || !items.length || innerWidth < 768) return () => {};
  const update = () => {
    for (const el of items) {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -100 || r.top > innerHeight + 100) continue;
      const c = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      el.style.transform = `translate3d(0, ${(c * Number(el.dataset.parallax)).toFixed(1)}px, 0) scale(1.12)`;
    }
  };
  let pending = false;
  const onScroll = () => { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; update(); }); } };
  addEventListener('scroll', onScroll, { passive: true });
  update();
  return () => removeEventListener('scroll', onScroll);
}

/* ---------- Brillo del logo bajo el puntero ---------- */
export function initLogoLight(wrap) {
  if (reduced() || !finePointer()) return () => {};
  const onMove = (e) => {
    const r = wrap.getBoundingClientRect();
    wrap.style.setProperty('--lx', `${e.clientX - r.left}px`);
    wrap.style.setProperty('--ly', `${e.clientY - r.top}px`);
  };
  wrap.addEventListener('pointermove', onMove, { passive: true });
  return () => wrap.removeEventListener('pointermove', onMove);
}
