/* cortex/brain.js — the 3d brain you fall into.
 * a point-cloud brain, neural lines with travelling pulses,
 * and a liquid nacre core with a halo outline (like the character).
 * exposes window.NacreBrain                                           */
(function () {
  'use strict';
  if (!window.THREE) { window.NacreBrain = null; return; }
  const T = window.THREE;

  const NACRE_GLSL = `
    vec3 nacre(float t){
      vec3 c1=vec3(1.0,0.31,0.85), c2=vec3(0.61,0.30,1.0), c3=vec3(0.49,0.96,1.0),
           c4=vec3(0.78,1.0,0.24), c5=vec3(1.0,0.88,0.29);
      t = fract(t) * 5.0;
      if (t < 1.0) return mix(c1, c2, t);
      if (t < 2.0) return mix(c2, c3, t - 1.0);
      if (t < 3.0) return mix(c3, c4, t - 2.0);
      if (t < 4.0) return mix(c4, c5, t - 3.0);
      return mix(c5, c1, t - 4.0);
    }`;

  // ashima 3d simplex noise
  const NOISE_GLSL = `
    vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
      vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
      i=mod289(i);
      vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
      float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
      vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
      vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
      vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
      vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
      return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }`;

  // displaced surface shared by core + outline
  const DISPLACE_GLSL = `
    uniform float uTime; uniform float uAmp;
    float field(vec3 p){ return snoise(p*1.05 + vec3(0.0, uTime*0.16, uTime*0.06))*0.75 + snoise(p*2.1 - uTime*0.1)*0.18; }
    vec3 displaced(vec3 p, vec3 n){ return p + n * field(p) * uAmp; }
    vec3 dispNormal(vec3 p, vec3 n){
      vec3 t = normalize(abs(n.y) < 0.99 ? cross(n, vec3(0.0,1.0,0.0)) : cross(n, vec3(1.0,0.0,0.0)));
      vec3 b = normalize(cross(n, t));
      float e = 0.02;
      vec3 p0 = displaced(p, n);
      vec3 pt = displaced(normalize(p + t*e)*length(p), normalize(p + t*e));
      vec3 pb = displaced(normalize(p + b*e)*length(p), normalize(p + b*e));
      return normalize(cross(pt - p0, pb - p0));
    }`;

  function rand(seed) { let s = seed >>> 0 || 7; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  function create(canvas) {
    const mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
    const renderer = new T.WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    renderer.setClearColor(0x000000, 1);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(55, 1, 0.01, 120);
    const R = rand(20261001);
    const brain = new T.Group();
    brain.rotation.x = 0.32;
    scene.add(brain);
    const uniforms = { uTime: { value: 0 }, uPR: { value: renderer.getPixelRatio() }, uFocus: { value: -1 }, uFear: { value: 0 } };

    /* ---------- point-cloud brain ---------- */
    const N = mobile ? 4200 : 9000;
    const pos = new Float32Array(N * 3), seed = new Float32Array(N), shell = new Float32Array(N);
    const SCALE = 2.25;
    for (let i = 0; i < N; i++) {
      const u = R() * 2 - 1, th = R() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const dx = r * Math.cos(th), dy = u, dz = r * Math.sin(th);
      let x = dx * 1.02, y = dy * 0.82, z = dz * 1.3;
      if (y < -0.32) y = -0.32 + (y + 0.32) * 0.45;              // flatter base
      const fis = Math.exp(-(dx * dx) / 0.004) * Math.max(0, dy + 0.2) * 0.32; // longitudinal fissure
      const gyri = 0.07 * Math.sin(dx * 15 + Math.sin(dz * 9) * 1.7) * Math.sin(dy * 13 + dz * 8);
      const onShell = R() < 0.86;
      const depth = onShell ? 1 : 0.35 + R() * 0.55;
      const s = (1 + gyri - fis) * depth * SCALE;
      pos[i * 3] = x * s; pos[i * 3 + 1] = y * s; pos[i * 3 + 2] = z * s;
      seed[i] = R(); shell[i] = onShell ? 1 : 0;
    }
    const pg = new T.BufferGeometry();
    pg.setAttribute('position', new T.BufferAttribute(pos, 3));
    pg.setAttribute('aSeed', new T.BufferAttribute(seed, 1));
    pg.setAttribute('aShell', new T.BufferAttribute(shell, 1));
    const pointsMat = new T.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: `
        uniform float uTime; uniform float uPR; uniform float uFocus;
        attribute float aSeed; attribute float aShell;
        varying vec3 vCol; varying float vA;
        ${NACRE_GLSL}
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float d = -mv.z;
          float tw = 0.55 + 0.45 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 40.0);
          float boost = 1.0;
          if (uFocus == 0.0) boost = mix(0.6, 2.2, aShell);
          if (uFocus == 2.0) boost = mix(2.6, 0.5, aShell);
          vCol = nacre(position.y * 0.12 + position.z * 0.08 + aSeed * 0.35 + uTime * 0.03);
          vA = clamp(tw * boost * smoothstep(14.0, 2.0, d), 0.0, 1.6) * smoothstep(0.05, 0.6, d);
          gl_PointSize = (aShell > 0.5 ? 4.2 : 5.2) * uPR * (6.0 / max(d, 0.4)) * (0.7 + aSeed * 0.8);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vCol; varying float vA;
        void main(){
          vec2 c = gl_PointCoord - 0.5; float r = length(c);
          float a = smoothstep(0.5, 0.0, r);
          gl_FragColor = vec4(vCol * (0.8 + 0.9 * smoothstep(0.22, 0.0, r)), a * vA);
        }`,
    });
    brain.add(new T.Points(pg, pointsMat));

    /* ---------- neural lines (nearest neighbours) ---------- */
    const M = mobile ? 900 : 1900;
    const idx = [];
    for (let i = 0; i < M; i++) idx.push(Math.floor(R() * N));
    const segs = [];
    const maxD2 = 0.5 * 0.5;
    for (let a = 0; a < M; a++) {
      const ia = idx[a]; const ax = pos[ia * 3], ay = pos[ia * 3 + 1], az = pos[ia * 3 + 2];
      let b1 = -1, d1 = 1e9, b2 = -1, d2 = 1e9;
      for (let b = 0; b < M; b++) {
        if (b === a) continue;
        const ib = idx[b]; const dx = pos[ib * 3] - ax, dy = pos[ib * 3 + 1] - ay, dz = pos[ib * 3 + 2] - az;
        const dd = dx * dx + dy * dy + dz * dz;
        if (dd < d1) { d2 = d1; b2 = b1; d1 = dd; b1 = b; } else if (dd < d2) { d2 = dd; b2 = b; }
      }
      if (b1 >= 0 && d1 < maxD2 && a < b1) segs.push([ia, idx[b1]]);
      if (b2 >= 0 && d2 < maxD2 * 1.6) segs.push([ia, idx[b2]]);
    }
    const lpos = new Float32Array(segs.length * 6), lseed = new Float32Array(segs.length * 2);
    segs.forEach(([a, b], i) => {
      lpos.set([pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2], pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]], i * 6);
      const s = R(); lseed[i * 2] = s; lseed[i * 2 + 1] = s;
    });
    const lg = new T.BufferGeometry();
    lg.setAttribute('position', new T.BufferAttribute(lpos, 3));
    lg.setAttribute('aSeed', new T.BufferAttribute(lseed, 1));
    const lineMat = new T.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: `
        uniform float uTime; uniform float uFocus; attribute float aSeed; varying vec3 vCol; varying float vA;
        ${NACRE_GLSL}
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float d = -mv.z;
          vCol = nacre(aSeed + position.x * 0.06 + uTime * 0.04);
          float flick = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 2.2 + aSeed * 60.0), 3.0);
          vA = flick * smoothstep(13.0, 2.5, d) * smoothstep(0.05, 0.5, d) * (uFocus == 1.0 ? 2.4 : 1.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying vec3 vCol; varying float vA; void main(){ gl_FragColor = vec4(vCol, vA * 0.5); }`,
    });
    brain.add(new T.LineSegments(lg, lineMat));

    /* ---------- pulses travelling along synapses ---------- */
    const P = mobile ? 120 : 280;
    const ppos = new Float32Array(P * 3), pstate = [];
    for (let i = 0; i < P; i++) pstate.push({ s: Math.floor(R() * segs.length), t: R(), v: 0.4 + R() * 0.9 });
    const pulseG = new T.BufferGeometry();
    pulseG.setAttribute('position', new T.BufferAttribute(ppos, 3));
    const pulseMat = new T.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: `
        uniform float uPR;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 9.0 * uPR * (5.0 / max(-mv.z, 0.3));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        void main(){
          float r = length(gl_PointCoord - 0.5);
          float core = smoothstep(0.18, 0.0, r), halo = smoothstep(0.5, 0.0, r);
          gl_FragColor = vec4(mix(vec3(0.78, 1.0, 0.24), vec3(0.95, 1.0, 0.84), core), halo * 0.55 + core);
        }`,
    });
    brain.add(new T.Points(pulseG, pulseMat));

    /* ---------- nacre core + halo outline ---------- */
    const coreGeo = new T.IcosahedronGeometry(0.82, mobile ? 28 : 44);
    const coreMat = new T.ShaderMaterial({
      uniforms: Object.assign({ uAmp: { value: 0.26 } }, uniforms),
      vertexShader: `
        ${NOISE_GLSL}
        ${DISPLACE_GLSL}
        varying vec3 vN; varying vec3 vW; varying float vF;
        void main(){
          vec3 n = normalize(position);
          vec3 p = displaced(position, n);
          vF = field(position);
          vN = normalize(mat3(modelMatrix) * dispNormal(position, n));
          vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `
        uniform float uTime; uniform float uFear;
        varying vec3 vN; varying vec3 vW; varying float vF;
        ${NACRE_GLSL}
        void main(){
          vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
          float fres = 1.0 - max(dot(N, V), 0.0);
          vec3 R = reflect(-V, N);
          float film = fres * 1.4 + vF * 0.9 + R.y * 0.35 + uTime * 0.04;
          vec3 col = nacre(film);
          float bands = smoothstep(0.78, 1.0, sin(R.y * 7.0 + R.x * 2.5 + uTime * 0.4) * 0.5 + 0.5);
          float spec = pow(max(dot(R, normalize(vec3(0.4, 0.9, 0.5))), 0.0), 36.0);
          col = col * (0.18 + 1.15 * pow(fres, 1.3)) + bands * vec3(1.0, 0.92, 1.0) * 0.85 + spec * 1.2;
          col += vec3(1.0, 0.2, 0.6) * uFear * (0.35 + 0.35 * sin(uTime * 9.0));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const outlineMat = new T.ShaderMaterial({
      uniforms: Object.assign({ uAmp: { value: 0.26 }, uOutline: { value: 0.045 } }, uniforms),
      side: T.BackSide,
      vertexShader: `
        ${NOISE_GLSL}
        ${DISPLACE_GLSL}
        uniform float uOutline;
        void main(){
          vec3 n = normalize(position);
          vec3 p = displaced(position, n);
          vec3 dn = dispNormal(position, n);
          p += dn * uOutline;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `uniform float uTime; void main(){ gl_FragColor = vec4(0.95, 1.0, 0.84, 1.0); }`,
    });
    const core = new T.Group();
    core.add(new T.Mesh(coreGeo, outlineMat));
    core.add(new T.Mesh(coreGeo, coreMat));
    scene.add(core);

    /* ---------- far dots (the coloured dot grid from the refs) ---------- */
    const F = 900, fpos = new Float32Array(F * 3), fcol = new Float32Array(F * 3);
    const pal = [[1, .31, .85], [.61, .3, 1], [.49, .96, 1], [.78, 1, .24], [1, .88, .29], [.95, 1, .84]];
    for (let i = 0; i < F; i++) {
      const u = R() * 2 - 1, th = R() * Math.PI * 2, r = Math.sqrt(1 - u * u), rad = 16 + R() * 18;
      fpos.set([r * Math.cos(th) * rad, u * rad, r * Math.sin(th) * rad], i * 3);
      fcol.set(pal[Math.floor(R() * pal.length)], i * 3);
    }
    const fg = new T.BufferGeometry();
    fg.setAttribute('position', new T.BufferAttribute(fpos, 3));
    fg.setAttribute('color', new T.BufferAttribute(fcol, 3));
    const far = new T.Points(fg, new T.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false }));
    scene.add(far);

    /* ---------- camera path through the brain ---------- */
    const path = new T.CatmullRomCurve3([
      new T.Vector3(0.0, 0.5, 9.0),
      new T.Vector3(2.4, 1.2, 5.6),
      new T.Vector3(3.0, 0.6, 2.8),
      new T.Vector3(1.6, -0.1, 1.55),
      new T.Vector3(-0.5, 0.7, 1.75),
      new T.Vector3(-1.75, 0.15, -0.2),
      new T.Vector3(-0.5, -0.25, -1.85),
      new T.Vector3(1.45, 0.35, -1.45),
    ], false, 'catmullrom', 0.4);

    const state = { hero: 0, dive: 0, ambient: false, visible: false, mx: 0, my: 0, smx: 0, smy: 0, focus: -1, fear: 0 };
    const look = new T.Vector3(), tmp = new T.Vector3(), want = new T.Vector3(0, 0.5, 19), wantLook = new T.Vector3(), curLook = new T.Vector3();
    camera.position.copy(want);
    const clock = new T.Clock();

    function resize() {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w / h < 0.8 ? 70 : 55;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', e => { state.mx = e.clientX / window.innerWidth - 0.5; state.my = e.clientY / window.innerHeight - 0.5; }, { passive: true });

    function frame() {
      requestAnimationFrame(frame);
      if (!state.visible || document.hidden) { clock.getDelta(); return; }
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = (uniforms.uTime.value += dt);
      state.smx += (state.mx - state.smx) * 0.05; state.smy += (state.my - state.smy) * 0.05;

      // pulses
      const sp = state.focus === 4 ? 3.2 : 1;
      for (let i = 0; i < P; i++) {
        const p = pstate[i]; p.t += dt * p.v * sp;
        if (p.t > 1) { p.t = 0; p.s = Math.floor(Math.random() * segs.length); p.v = 0.4 + Math.random() * 0.9; }
        const o = p.s * 6;
        ppos[i * 3] = lpos[o] + (lpos[o + 3] - lpos[o]) * p.t;
        ppos[i * 3 + 1] = lpos[o + 1] + (lpos[o + 4] - lpos[o + 1]) * p.t;
        ppos[i * 3 + 2] = lpos[o + 2] + (lpos[o + 5] - lpos[o + 2]) * p.t;
      }
      pulseG.attributes.position.needsUpdate = true;

      uniforms.uFocus.value = state.focus;
      uniforms.uFear.value += ((state.focus === 3 ? 1 : 0) * (0.4 + state.fear * 0.6) - uniforms.uFear.value) * 0.06;
      brain.rotation.y = t * 0.035;
      core.rotation.y = t * 0.12;
      far.rotation.y = -t * 0.006;

      // camera: compute where it wants to be, then glide there
      let k = 0.12;
      if (state.ambient) {
        const a = t * 0.05;
        want.set(Math.sin(a) * 7.2, 0.9 + Math.sin(t * 0.13) * 0.4, Math.cos(a) * 7.2);
        wantLook.set(0, 0, 0); k = 0.045;
      } else if (state.dive <= 0) {
        const pre = 1 - state.hero;
        want.set(0, 0.5, 9 + pre * pre * 10); wantLook.set(0, 0, 0); k = 0.2;
      } else {
        path.getPointAt(Math.min(state.dive, 1), want);
        path.getPointAt(Math.min(state.dive + 0.06, 1), tmp);
        wantLook.copy(tmp).multiplyScalar(0.25);
      }
      want.x += state.smx * 0.5; want.y -= state.smy * 0.35;
      camera.position.lerp(want, k);
      // never fly through the core: keep a minimum distance from the centre
      const dist = camera.position.length();
      if (dist < 1.75) camera.position.multiplyScalar(1.75 / Math.max(dist, 0.001));
      curLook.lerp(wantLook, k);
      camera.lookAt(curLook);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);

    return {
      set(o) { Object.assign(state, o); },
      get state() { return state; },
    };
  }

  window.NacreBrain = { create };
})();
