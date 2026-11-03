// Logo en 3D sin redibujarlo: la cara frontal son los píxeles del archivo original
// y el canto se extruye a partir de su propio contorno (marching squares).
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ss = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

const DEPTH = 0.17, DIST = 4.2, FOCAL = 2.2;

const SHARED = `
uniform vec2 uRot; uniform vec2 uOff; uniform vec2 uProj; uniform float uScale;
vec3 place(vec3 p){
  float cy=cos(uRot.y),sy=sin(uRot.y),cx=cos(uRot.x),sx=sin(uRot.x);
  vec3 q=vec3(cy*p.x+sy*p.z,p.y,-sy*p.x+cy*p.z);
  return vec3(q.x,cx*q.y-sx*q.z,sx*q.y+cx*q.z);
}
vec4 project(vec3 w){
  w*=uScale; float c=${DIST.toFixed(1)}-w.z;
  return vec4((w.x*uProj.x+uOff.x*c),(w.y*uProj.y+uOff.y*c),(-w.z/12.)*c,c);
}`;

const LIGHT = `
uniform float uSweep; uniform vec2 uLight; uniform float uBright;
vec3 env(vec3 r){
  vec3 c=mix(vec3(.16,.105,.04),vec3(1.,.9,.68),smoothstep(-.7,.85,r.y));
  c+=vec3(1.,.9,.7)*smoothstep(.2,.0,abs(r.x-uLight.x*.8))*smoothstep(-.3,.7,r.y)*.7;
  return c;
}`;

const CAP_VS = `#version 300 es
in vec2 a; out vec2 vUv; out vec2 vW; ${SHARED}
void main(){ vUv=vec2(a.x*.5+.5,.5-a.y*.5); vW=a; gl_Position=project(place(vec3(a,uDepth)));}`.replace('out vec2 vW;', 'out vec2 vW; uniform float uDepth;');

const CAP_FS = `#version 300 es
precision highp float;
in vec2 vUv; in vec2 vW; out vec4 o; uniform sampler2D uTex; uniform sampler2D uNor; uniform vec2 uRot;
${LIGHT}
vec3 turn(vec3 p){float cy=cos(uRot.y),sy=sin(uRot.y),cx=cos(uRot.x),sx=sin(uRot.x);
  vec3 q=vec3(cy*p.x+sy*p.z,p.y,-sy*p.x+cy*p.z);return vec3(q.x,cx*q.y-sx*q.z,sx*q.y+cx*q.z);}
void main(){
  vec4 t=texture(uTex,vUv);
  float w=max(fwidth(t.a)*.75,.015);
  float al=smoothstep(.5-w,.5+w,t.a);
  if(al<.004) discard;
  vec2 nx=(texture(uNor,vUv).rg-.5)*2.;
  vec3 n=normalize(turn(vec3(nx*1.7,1.)));
  vec3 r=reflect(vec3(0.,0.,-1.),n);
  float dif=clamp(dot(n,normalize(vec3(uLight,1.1))),0.,1.);
  vec3 c=t.rgb*(.74+.3*dif)+t.rgb*env(r)*.2;
  float sheen=smoothstep(.34,.0,abs(vW.x+vW.y*.45-uSweep));
  c+=vec3(1.,.93,.76)*sheen*.5*t.rgb;
  c+=vec3(1.,.95,.82)*pow(clamp(dot(r,normalize(vec3(uLight,1.))),0.,1.),26.)*.55;
  o=vec4(c*uBright*al,al);
}`;

const WALL_VS = `#version 300 es
in vec3 a; in vec2 n; out vec3 vN; out float vZ; uniform float uDepth; ${SHARED}
void main(){ vN=place(vec3(n,.0)); vZ=a.z*.5+.5; gl_Position=project(place(vec3(a.xy,a.z*uDepth)));}`;

const WALL_FS = `#version 300 es
precision highp float;
in vec3 vN; in float vZ; out vec4 o;
${LIGHT}
void main(){
  vec3 n=normalize(vN+vec3(0.,0.,.0001));
  vec3 r=reflect(vec3(0.,0.,-1.),n);
  vec3 g=vec3(.62,.44,.2);
  vec3 c=g*(.32+.8*clamp(dot(n,normalize(vec3(uLight,.55))),0.,1.))+g*env(r)*.55;
  c*=mix(.34,1.,vZ);
  o=vec4(c*uBright,1.);
}`;

const DUST_VS = `#version 300 es
in vec4 a; out float vA; uniform float uT; uniform vec2 uPar; uniform vec2 uRes;
void main(){
  float y=fract(a.y+uT*.012*(.4+a.w))*2.4-1.2;
  float x=a.x+sin(uT*.2+a.w*9.)*.05+uPar.x*a.z*.05;
  vA=smoothstep(1.2,.7,abs(y))*(.35+.45*sin(uT*.9+a.w*30.)*sin(uT*.9+a.w*30.));
  gl_Position=vec4(x,y+uPar.y*a.z*.05,0.,1.);
  gl_PointSize=(1.2+a.z*2.8)*uRes.y/900.*${'1.6'};
}`;

const DUST_FS = `#version 300 es
precision mediump float;
in float vA; out vec4 o;
void main(){ float d=length(gl_PointCoord-.5); float s=smoothstep(.5,.05,d); o=vec4(vec3(.94,.82,.58)*s*vA,s*vA*.6);}`;

function program(gl, vs, fs) {
  const make = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, make(gl.VERTEX_SHADER, vs)); gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  for (let i = 0, c = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < c; i++) {
    const { name } = gl.getActiveUniform(p, i); u[name] = gl.getUniformLocation(p, name);
  }
  return { p, u };
}

/* ---------- Del archivo original a texturas y malla ---------- */
function boxBlur(src, S, r) {
  const a = new Float32Array(src), b = new Float32Array(S * S), k = 1 / (2 * r + 1);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < S; y++) {
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += a[y * S + clamp(x, 0, S - 1)];
      for (let x = 0; x < S; x++) {
        b[x * S + y] = sum * k;
        sum += a[y * S + Math.min(S - 1, x + r + 1)] - a[y * S + Math.max(0, x - r)];
      }
    }
    a.set(b); // Cada pasada traspone: dos pasadas desenfocan en ambos ejes y restauran la orientación.
  }
  return a;
}

async function digest(src, S, G) {
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, S, S);
  const px = x.getImageData(0, 0, S, S).data;
  const mask = new Float32Array(S * S), color = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    const m = clamp((Math.max(r, g, b) / 255 - 0.14) / 0.5);
    mask[i] = m;
    // El borde mezcla dorado con el negro del fondo: se recupera el dorado para que no salga un halo oscuro.
    if (m < 0.02) color.set([233, 203, 133, 0], i * 4);
    else { const k = m < 1 ? 1 / Math.max(m, 0.45) : 1; color.set([Math.min(255, r * k), Math.min(255, g * k), Math.min(255, b * k), m * 255], i * 4); }
  }
  const soft = boxBlur(mask, S, Math.round(S / 200));
  // El canto usa un desenfoque más ancho: normales suaves, sin estrías al acercarse.
  const wide = boxBlur(mask, S, Math.round(S / 90));
  const contour = boxBlur(mask, S, 1);
  const nor = new Uint8Array(S * S * 4), nArr = new Float32Array(S * S * 2);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const xl = y * S + Math.max(0, xx - 1), xr = y * S + Math.min(S - 1, xx + 1);
    const yu = Math.max(0, y - 1) * S + xx, yd = Math.min(S - 1, y + 1) * S + xx;
    const nx = clamp((soft[xl] - soft[xr]) * S / 110, -1, 1), ny = clamp((soft[yd] - soft[yu]) * S / 110, -1, 1);
    const i = y * S + xx;
    nArr[i * 2] = wide[xl] - wide[xr]; nArr[i * 2 + 1] = wide[yd] - wide[yu];
    nor.set([(nx * 0.5 + 0.5) * 255, (ny * 0.5 + 0.5) * 255, 128, 255], i * 4);
  }

  // Contorno: dos triángulos por cada segmento, del frente al fondo.
  const sample = (gx, gy) => {
    const fx = gx / G * (S - 1), fy = gy / G * (S - 1), x0 = Math.floor(fx), y0 = Math.floor(fy);
    const x1 = Math.min(S - 1, x0 + 1), y1 = Math.min(S - 1, y0 + 1), ax = fx - x0, ay = fy - y0;
    return mix(mix(contour[y0 * S + x0], contour[y0 * S + x1], ax), mix(contour[y1 * S + x0], contour[y1 * S + x1], ax), ay);
  };
  const out = [];
  const vert = (gx, gy) => {
    const i = Math.min(S - 1, Math.round(gy / G * (S - 1))) * S + Math.min(S - 1, Math.round(gx / G * (S - 1)));
    const len = Math.hypot(nArr[i * 2], nArr[i * 2 + 1]) || 1;
    return [gx / G * 2 - 1, 1 - gy / G * 2, nArr[i * 2] / len, nArr[i * 2 + 1] / len];
  };
  const seg = (a, b) => {
    const [A, B] = [vert(...a), vert(...b)];
    out.push(A[0], A[1], 1, A[2], A[3], B[0], B[1], 1, B[2], B[3], B[0], B[1], -1, B[2], B[3],
      A[0], A[1], 1, A[2], A[3], B[0], B[1], -1, B[2], B[3], A[0], A[1], -1, A[2], A[3]);
  };
  const T = 0.5;
  for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
    const a = sample(gx, gy), b = sample(gx + 1, gy), cc = sample(gx + 1, gy + 1), dd = sample(gx, gy + 1);
    const code = (a > T) | (b > T) << 1 | (cc > T) << 2 | (dd > T) << 3;
    if (code === 0 || code === 15) continue;
    const top = [gx + (T - a) / (b - a || 1), gy], right = [gx + 1, gy + (T - b) / (cc - b || 1)];
    const bottom = [gx + (T - dd) / (cc - dd || 1), gy + 1], left = [gx, gy + (T - a) / (dd - a || 1)];
    const table = { 1: [[left, top]], 2: [[top, right]], 3: [[left, right]], 4: [[right, bottom]], 5: [[left, top], [right, bottom]], 6: [[top, bottom]], 7: [[left, bottom]], 8: [[bottom, left]], 9: [[bottom, top]], 10: [[top, right], [bottom, left]], 11: [[bottom, right]], 12: [[right, left]], 13: [[right, top]], 14: [[top, left]] };
    table[code].forEach(([p, q]) => seg(p, q));
  }
  return { color, nor, walls: new Float32Array(out), S };
}

/* ---------- Escena ---------- */
export function initLogo3D({ canvas, stage, anchor, section, src, onScene }) {
  let gl;
  try { gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, powerPreference: 'high-performance' }); } catch { gl = null; }
  if (!gl) { canvas.remove(); return () => {}; }
  let stopped = false, raf = 0, dispose = () => {};
  const still = reduced();
  const small = innerWidth < 768;

  digest(src, small ? 768 : 1024, small ? 300 : 440).then(({ color, nor, walls, S }) => {
    if (stopped) return;
    const texture = (data, unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    texture(color, 0); texture(nor, 1);

    const cap = program(gl, CAP_VS, CAP_FS), wall = program(gl, WALL_VS, WALL_FS), dust = program(gl, DUST_VS, DUST_FS);

    const capVao = gl.createVertexArray(); gl.bindVertexArray(capVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const capA = gl.getAttribLocation(cap.p, 'a');
    gl.enableVertexAttribArray(capA); gl.vertexAttribPointer(capA, 2, gl.FLOAT, false, 0, 0);

    const wallVao = gl.createVertexArray(); gl.bindVertexArray(wallVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, walls, gl.STATIC_DRAW);
    const wA = gl.getAttribLocation(wall.p, 'a'), wN = gl.getAttribLocation(wall.p, 'n');
    gl.enableVertexAttribArray(wA); gl.vertexAttribPointer(wA, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(wN); gl.vertexAttribPointer(wN, 2, gl.FLOAT, false, 20, 12);
    const wallCount = walls.length / 5;

    const DUST = small ? 36 : 80;
    const dustData = new Float32Array(DUST * 4).map(() => Math.random());
    for (let i = 0; i < DUST; i++) dustData[i * 4] = dustData[i * 4] * 2.2 - 1.1;
    const dustVao = gl.createVertexArray(); gl.bindVertexArray(dustVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, dustData, gl.STATIC_DRAW);
    const dA = gl.getAttribLocation(dust.p, 'a');
    gl.enableVertexAttribArray(dA); gl.vertexAttribPointer(dA, 4, gl.FLOAT, false, 0, 0);

    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.clearColor(0, 0, 0, 0);

    let W = 1, H = 1, base = { x: 0, y: 0, L: 400 }, pinned = false;
    const pinQuery = matchMedia('(min-width: 1024px) and (hover: hover)');
    const measure = () => {
      pinned = pinQuery.matches && !still;
      section.classList.toggle('is-pinned', pinned);
      const dpr = Math.min(devicePixelRatio || 1, small ? 1.5 : 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      const s = stage.getBoundingClientRect(), a = anchor.getBoundingClientRect();
      base = { x: ((a.left + a.width / 2 - s.left) / W) * 2 - 1, y: 1 - ((a.top + a.height / 2 - s.top) / H) * 2, L: a.width * 1.18 }; // El archivo trae márgenes negros: se compensan.
    };

    let px = 0, py = 0, tx = 0, ty = 0;
    const onMove = (e) => { tx = e.clientX / innerWidth * 2 - 1; ty = 1 - e.clientY / innerHeight * 2; };
    if (!still && matchMedia('(hover: hover)').matches) addEventListener('pointermove', onMove, { passive: true });

    const t0 = performance.now();
    const draw = (now) => {
      const t = still ? 60 : (now - t0) / 1000;
      px += (tx - px) * 0.05; py += (ty - py) * 0.05;
      const r = section.getBoundingClientRect();
      const travel = Math.max(1, r.height - stage.offsetHeight);
      const p = pinned ? clamp(-r.top / travel) : 0;
      onScene?.(p, pinned);

      const e = 1 - (1 - clamp(t / 2.6)) ** 3;
      const toCentre = ss(0.02, 0.3, p), push = ss(0.6, 1, p);
      const offX = mix(base.x, 0, toCentre), offY = mix(base.y, 0.14, toCentre);
      const L = mix(base.L, Math.min(H * 0.62, W * 0.46), toCentre);
      const scale = (L / H) * (DIST / FOCAL) * (0.86 + 0.14 * e) * (1 + push * push * push * 9);

      const mobileDrift = pinned ? 0 : clamp(-r.top / Math.max(1, r.height)) * 0.5;
      const yaw = (1 - e) * -1.15 + (still ? -0.2 : Math.sin(t * 0.38) * 0.17 * (1 - push)) + px * 0.2 + mix(-0.36, 0.36, ss(0.05, 0.6, p)) * ss(0.02, 0.1, p) * (1 - push) + mobileDrift;
      const pitch = (still ? 0.06 : Math.cos(t * 0.29) * 0.05) - py * 0.12;

      const cycle = (t - 1.4) % 8;
      const sweep = t < 1.4 ? -3 : mix(-2.4, 2.8, clamp(cycle / 2.2));
      const light = [0.35 + px * 0.9 + Math.sin(t * 0.3) * 0.25, 0.55 + py * 0.6];
      const depth = DEPTH * (still ? 1 : e) * (1 - push * 0.65) * 0.5 + 0.0005;
      const bright = mix(0.25, 1, ss(0, 1.5, t));

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const common = (pr) => {
        gl.useProgram(pr.p);
        gl.uniform2f(pr.u.uRot, pitch, yaw); gl.uniform2f(pr.u.uOff, offX, offY);
        gl.uniform2f(pr.u.uProj, FOCAL * H / W, FOCAL); gl.uniform1f(pr.u.uScale, scale);
        gl.uniform1f(pr.u.uDepth, depth); gl.uniform1f(pr.u.uSweep, sweep);
        gl.uniform2f(pr.u.uLight, light[0], light[1]); gl.uniform1f(pr.u.uBright, bright);
      };
      gl.disable(gl.BLEND); gl.depthMask(true);
      common(wall); gl.bindVertexArray(wallVao); gl.drawArrays(gl.TRIANGLES, 0, wallCount);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      common(cap); gl.uniform1i(cap.u.uTex, 0); gl.uniform1i(cap.u.uNor, 1);
      gl.bindVertexArray(capVao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!still) {
        gl.disable(gl.DEPTH_TEST); gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(dust.p); gl.uniform1f(dust.u.uT, t); gl.uniform2f(dust.u.uPar, px, py); gl.uniform2f(dust.u.uRes, W, H);
        gl.bindVertexArray(dustVao); gl.drawArrays(gl.POINTS, 0, DUST);
        gl.enable(gl.DEPTH_TEST);
      }
      section.classList.add('gl-on');
    };

    let visible = true;
    const loop = (now) => { raf = requestAnimationFrame(loop); draw(now); };
    const sync = () => {
      cancelAnimationFrame(raf); raf = 0;
      if (!still && visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const ro = new ResizeObserver(() => { measure(); if (still) draw(0); });
    ro.observe(canvas);
    measure();
    if (still) draw(0); else draw(performance.now());
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; sync(); });
    io.observe(stage);
    document.addEventListener('visibilitychange', sync);
    sync();
    dispose = () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', sync);
    };
  }).catch((err) => {
    // Sin 3D la portada sigue completa con la imagen original.
    console.warn('Logo 3D no disponible:', err.message);
    canvas.remove();
  });
  return () => { stopped = true; dispose(); };
}
