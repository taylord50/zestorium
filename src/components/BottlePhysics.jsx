import { useRef, useEffect, useCallback, useState } from 'react';
import Matter from 'matter-js';

/**
 * BottlePhysics — bottle as a rigid body that tips with gyro,
 * with SPH fluid simulated in the bottle's local frame (ported from LiquidBottle).
 * Fluid coordinates live in the same 280x420 space as LiquidBottle so the
 * sim parameters carry over exactly; they're transformed to world space at draw.
 */

const BOTTLE_IMG = '/bottle-nolabel.png';

// ---------- Rigid body collision polygon (traced from bottle pixels) ----------
const BOTTLE_VERTICES = [
  // Flat top — through top of cork
  { x: -0.07, y: -0.44 },
  { x: 0.07, y: -0.44 },
  // Neck (narrow)
  { x: 0.075, y: -0.35 },
  { x: 0.073, y: -0.22 },
  // Shoulder transition
  { x: 0.08, y: -0.17 },
  { x: 0.13, y: -0.12 },
  { x: 0.18, y: -0.07 },
  { x: 0.20, y: -0.02 },
  // Body right
  { x: 0.205, y: 0.05 },
  { x: 0.205, y: 0.15 },
  { x: 0.205, y: 0.25 },
  { x: 0.205, y: 0.35 },
  { x: 0.20, y: 0.39 },
  // Flat bottom — through average of bottom curve
  { x: 0.17, y: 0.42 },
  { x: -0.17, y: 0.42 },
  // Body left
  { x: -0.20, y: 0.39 },
  { x: -0.207, y: 0.35 },
  { x: -0.207, y: 0.25 },
  { x: -0.207, y: 0.15 },
  { x: -0.207, y: 0.05 },
  // Shoulder left
  { x: -0.20, y: -0.02 },
  { x: -0.18, y: -0.07 },
  { x: -0.13, y: -0.12 },
  { x: -0.09, y: -0.17 },
  // Neck left
  { x: -0.092, y: -0.22 },
  { x: -0.09, y: -0.35 },
  { x: -0.07, y: -0.44 },
];

// Standard, realistic physics defaults
const DEFAULT_PARAMS = {
  gravity: 1.0,
  friction: 0.5,
  frictionStatic: 0.8,
  frictionAir: 0.01,
  restitution: 0.2,
  density: 0.002,
  gravityScale: 1.0,
};

// ---------- Fluid sim (ported verbatim from LiquidBottle) ----------
const REST_DENSITY = 3.0;
const STIFFNESS = 0.2;
const STIFFNESS_NEAR = 0.4;
const INTERACTION_RADIUS = 18;
const VISCOSITY = 0.2;
const FLUID_GRAVITY = 0.2;
const DT = 1;
const PARTICLE_RADIUS = 5;
const VELOCITY_DAMPING = 0.97;
const PARTICLES_PER_ML = 0.85;
const FLUID_ML = 525; // ~500-550ml fill

// Fluid sim space (matches LiquidBottle canvas: bottle.png aspect 2:3)
const FW = 280;
const FH = 420;

// Bottle interior boundary traced from bottle.png pixels (same artwork outline)
const GLASS_INSET = 0.008;
const BOTTLE_PROFILE = [
  [0.4043, 0.5625, 0.1628],
  [0.4043, 0.5625, 0.1790],
  [0.4043, 0.5625, 0.1953],
  [0.4043, 0.5635, 0.2116],
  [0.4043, 0.5635, 0.2279],
  [0.4033, 0.5635, 0.2441],
  [0.4033, 0.5645, 0.2604],
  [0.4033, 0.5645, 0.2767],
  [0.4033, 0.5664, 0.2930],
  [0.3965, 0.5771, 0.3092],
  [0.3721, 0.6064, 0.3255],
  [0.3398, 0.6396, 0.3418],
  [0.3184, 0.6621, 0.3581],
  [0.3037, 0.6758, 0.3743],
  [0.2949, 0.6846, 0.3906],
  [0.2900, 0.6885, 0.4069],
  [0.2891, 0.6895, 0.4232],
  [0.2891, 0.6895, 0.4395],
  [0.2900, 0.6895, 0.4557],
  [0.2900, 0.6895, 0.4720],
  [0.2900, 0.6895, 0.4883],
  [0.2910, 0.6904, 0.5046],
  [0.2910, 0.6904, 0.5208],
  [0.2920, 0.6904, 0.5371],
  [0.2920, 0.6904, 0.5534],
  [0.2920, 0.6904, 0.5697],
  [0.2930, 0.6914, 0.5859],
  [0.2930, 0.6914, 0.6022],
  [0.2939, 0.6924, 0.6185],
  [0.2939, 0.6924, 0.6348],
  [0.2939, 0.6924, 0.6510],
  [0.2949, 0.6924, 0.6673],
  [0.2949, 0.6924, 0.6836],
  [0.2949, 0.6924, 0.6999],
  [0.2949, 0.6895, 0.7161],
  [0.2959, 0.6895, 0.7324],
  [0.2959, 0.6895, 0.7487],
  [0.2959, 0.6895, 0.7650],
  [0.2949, 0.6895, 0.7812],
  [0.2949, 0.6895, 0.7975],
  [0.2949, 0.6895, 0.8138],
  [0.2949, 0.6904, 0.8301],
  [0.2949, 0.6914, 0.8464],
  [0.2949, 0.6924, 0.8626],
  [0.2949, 0.6924, 0.8789],
  [0.3047, 0.6846, 0.8952],
];

const IMG_TOP = 0.163;
const IMG_BOTTOM = 0.89;

function getBottleEdgesAtY(y) {
  const yFrac = y / FH;
  if (yFrac <= BOTTLE_PROFILE[0][2]) {
    const p = BOTTLE_PROFILE[0];
    return { left: (p[0] + GLASS_INSET) * FW, right: (p[1] - GLASS_INSET) * FW };
  }
  for (let i = 0; i < BOTTLE_PROFILE.length - 1; i++) {
    const curr = BOTTLE_PROFILE[i];
    const next = BOTTLE_PROFILE[i + 1];
    if (yFrac >= curr[2] && yFrac <= next[2]) {
      const t = (yFrac - curr[2]) / (next[2] - curr[2]);
      return {
        left: (curr[0] + (next[0] - curr[0]) * t + GLASS_INSET) * FW,
        right: (curr[1] + (next[1] - curr[1]) * t - GLASS_INSET) * FW,
      };
    }
  }
  const last = BOTTLE_PROFILE[BOTTLE_PROFILE.length - 1];
  return { left: (last[0] + GLASS_INSET) * FW, right: (last[1] - GLASS_INSET) * FW };
}

function createFluidParticles(count, fillLevel) {
  const particles = [];
  const bodyTop = IMG_TOP * FH;
  const bodyBottom = IMG_BOTTOM * FH;
  const fillHeight = fillLevel * (bodyBottom - bodyTop);
  const startY = bodyBottom - fillHeight;
  for (let i = 0; i < count; i++) {
    const py = startY + Math.random() * fillHeight;
    const edges = getBottleEdgesAtY(py);
    particles.push({
      x: edges.left + Math.random() * (edges.right - edges.left),
      y: py,
      vx: 0, vy: 0, prevX: 0, prevY: 0,
    });
  }
  return particles;
}

// SPH double-density relaxation — same algorithm/params as LiquidBottle
function simulateFluid(particles, gx, gy, sleep) {
  const n = particles.length;

  if (Math.abs(gx - sleep.lastGx) > 0.02 || Math.abs(gy - sleep.lastGy) > 0.02) {
    sleep.sleeping = false;
    sleep.calmFrames = 0;
  }
  sleep.lastGx = gx;
  sleep.lastGy = gy;
  if (sleep.sleeping) return;

  for (let i = 0; i < n; i++) {
    const p = particles[i];
    p.prevX = p.x;
    p.prevY = p.y;
    p.vx += gx * DT;
    p.vy += gy * DT;
    p.x += p.vx * DT;
    p.y += p.vy * DT;
  }

  const cellSize = INTERACTION_RADIUS;
  const gridW = Math.ceil(FW / cellSize);
  const gridH = Math.ceil(FH / cellSize);
  const grid = new Array(gridW * gridH);
  for (let i = 0; i < n; i++) {
    const p = particles[i];
    const cx = Math.max(0, Math.min(gridW - 1, Math.floor(p.x / cellSize)));
    const cy = Math.max(0, Math.min(gridH - 1, Math.floor(p.y / cellSize)));
    const key = cy * gridW + cx;
    if (!grid[key]) grid[key] = [];
    grid[key].push(i);
  }

  const getNeighbors = (p) => {
    const cx = Math.max(0, Math.min(gridW - 1, Math.floor(p.x / cellSize)));
    const cy = Math.max(0, Math.min(gridH - 1, Math.floor(p.y / cellSize)));
    const result = [];
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const nx = cx + ox;
        const ny = cy + oy;
        if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
        const cell = grid[ny * gridW + nx];
        if (cell) result.push(...cell);
      }
    }
    return result;
  };

  for (let i = 0; i < n; i++) {
    const pi = particles[i];
    const neighbors = getNeighbors(pi);
    let density = 0;
    let nearDensity = 0;
    for (const j of neighbors) {
      if (i === j) continue;
      const pj = particles[j];
      const dx = pj.x - pi.x;
      const dy = pj.y - pi.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= INTERACTION_RADIUS) continue;
      const q = 1 - dist / INTERACTION_RADIUS;
      density += q * q;
      nearDensity += q * q * q;
    }
    const pressure = STIFFNESS * (density - REST_DENSITY);
    const nearPressure = STIFFNESS_NEAR * nearDensity;
    for (const j of neighbors) {
      if (i === j) continue;
      const pj = particles[j];
      const dx = pj.x - pi.x;
      const dy = pj.y - pi.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= INTERACTION_RADIUS || dist < 0.001) continue;
      const q = 1 - dist / INTERACTION_RADIUS;
      const force = (pressure * q + nearPressure * q * q) * DT * DT;
      const fx = (dx / dist) * force * 0.5;
      const fy = (dy / dist) * force * 0.5;
      pj.x += fx; pj.y += fy;
      pi.x -= fx; pi.y -= fy;
    }
  }

  for (let i = 0; i < n; i++) {
    const pi = particles[i];
    const neighbors = getNeighbors(pi);
    for (const j of neighbors) {
      if (j <= i) continue;
      const pj = particles[j];
      const dx = pj.x - pi.x;
      const dy = pj.y - pi.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= INTERACTION_RADIUS || dist < 0.001) continue;
      const q = 1 - dist / INTERACTION_RADIUS;
      const dvx = pi.vx - pj.vx;
      const dvy = pi.vy - pj.vy;
      const u = (dvx * dx + dvy * dy) / dist;
      if (u > 0) {
        const impulse = VISCOSITY * q * u;
        const ix = (dx / dist) * impulse;
        const iy = (dy / dist) * impulse;
        pi.vx -= ix * 0.5; pi.vy -= iy * 0.5;
        pj.vx += ix * 0.5; pj.vy += iy * 0.5;
      }
    }
  }

  // Boundary collision — bottle interior, rounded bottom
  const RENDER_INSET = PARTICLE_RADIUS * 2 + 5;
  const bottomY = IMG_BOTTOM * FH - RENDER_INSET;
  const topY = IMG_TOP * FH;
  const bodyLeft = 0.295 * FW;
  const bodyRight = 0.692 * FW;
  const centerX = (bodyLeft + bodyRight) / 2;
  const halfWidth = (bodyRight - bodyLeft) / 2;
  const bottomCurveHeight = 0.025 * FH;

  for (let i = 0; i < n; i++) {
    const p = particles[i];
    const dx = Math.max(-1, Math.min(1, (p.x - centerX) / halfWidth));
    const curveDrop = (1 - Math.sqrt(1 - dx * dx)) * bottomCurveHeight;
    const localBottom = bottomY - curveDrop;
    if (p.y > localBottom) { p.y = localBottom; p.vy = 0; }
    if (p.y < topY) { p.y = topY; p.vy = 0; }
    const edges = getBottleEdgesAtY(p.y);
    if (p.x < edges.left + RENDER_INSET) { p.x = edges.left + RENDER_INSET; p.vx = 0; }
    if (p.x > edges.right - RENDER_INSET) { p.x = edges.right - RENDER_INSET; p.vx = 0; }
  }

  let totalEnergy = 0;
  for (let i = 0; i < n; i++) {
    const p = particles[i];
    p.vx = ((p.x - p.prevX) / DT) * VELOCITY_DAMPING;
    p.vy = ((p.y - p.prevY) / DT) * VELOCITY_DAMPING;
    if (Math.abs(p.vx) < 0.02) p.vx = 0;
    if (Math.abs(p.vy) < 0.02) p.vy = 0;
    totalEnergy += p.vx * p.vx + p.vy * p.vy;
  }

  const avgEnergy = n > 0 ? totalEnergy / n : 0;
  if (avgEnergy < 0.15) {
    sleep.calmFrames++;
    if (sleep.calmFrames > 30) {
      sleep.sleeping = true;
      for (let i = 0; i < n; i++) { particles[i].vx = 0; particles[i].vy = 0; }
    }
  } else {
    sleep.calmFrames = 0;
  }
}

function BottlePhysics() {
  const canvasRef = useRef(null);
  const fluidCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const bottleBodyRef = useRef(null);
  const renderLoopRef = useRef(null);
  const bottleImgRef = useRef(null);
  const imgOffsetRef = useRef({ x: 0, y: 0 });
  const fluidRef = useRef(null);
  const fluidSleepRef = useRef({ sleeping: false, calmFrames: 0, lastGx: 0, lastGy: 0 });
  const [dims, setDims] = useState({ w: 320, h: 560 });

  // Load bottle image
  useEffect(() => {
    const img = new Image();
    img.src = BOTTLE_IMG;
    img.onload = () => { bottleImgRef.current = img; };
  }, []);

  // Measure viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = document.documentElement.clientWidth;
    const h = window.innerHeight;
    setDims({ w, h });
  }, []);

  // Bottle render size: same as old 42vh static bottle
  const renderH = window.innerHeight * 0.42;
  const renderW = renderH * (2 / 3);

  // Track whether bottle has landed (gyro disabled until then)
  const landedRef = useRef(false);

  // Initialize physics
  useEffect(() => {
    const { w, h } = dims;
    const p = DEFAULT_PARAMS;
    // enableSleeping: settled bodies freeze completely — kills micro-jitter
    // that would otherwise keep waking the fluid sim
    const engine = Matter.Engine.create({ enableSleeping: true });
    engine.gravity.y = p.gravity;
    engine.gravity.x = 0;
    engineRef.current = engine;

    const vertices = BOTTLE_VERTICES.map(v => ({
      x: v.x * renderW,
      y: v.y * renderH,
    }));

    // Floor position: ~68% down the screen (above the button area)
    const floorY = h * 0.68;

    const bottle = Matter.Bodies.fromVertices(w / 2, -renderH * 0.5, [vertices], {
      restitution: p.restitution,
      friction: p.friction,
      frictionStatic: p.frictionStatic,
      frictionAir: 0.002,
      density: p.density,
      render: { visible: false },
    });

    if (bottle) {
      // Exact image alignment: compare body bounds to definition-space bounds
      const defMinX = Math.min(...vertices.map(v => v.x));
      const defMinY = Math.min(...vertices.map(v => v.y));
      const cX = defMinX - (bottle.bounds.min.x - bottle.position.x);
      const cY = defMinY - (bottle.bounds.min.y - bottle.position.y);

      // Center of mass slightly below the shoulder line
      const COM_Y = 0.06 * renderH;
      Matter.Body.setCentre(bottle, { x: 0 - cX, y: COM_Y - cY }, true);
      imgOffsetRef.current = { x: 0, y: -COM_Y };

      bottleBodyRef.current = bottle;
      Matter.Composite.add(engine.world, bottle);

      // Fluid: ~525ml worth of particles, filled to the matching level
      const count = Math.round(FLUID_ML * PARTICLES_PER_ML);
      fluidRef.current = createFluidParticles(count, FLUID_ML / 750);
      fluidSleepRef.current = { sleeping: false, calmFrames: 0, lastGx: 0, lastGy: 0 };
    }

    // Walls — flush with visible screen edges
    const wallThickness = 60;
    const walls = [
      Matter.Bodies.rectangle(w / 2, floorY + wallThickness / 2, w * 3, wallThickness, { isStatic: true, friction: p.friction, frictionStatic: p.frictionStatic }),
      Matter.Bodies.rectangle(-wallThickness / 2, h / 2, wallThickness, h * 3, { isStatic: true, friction: 0.5 }),
      Matter.Bodies.rectangle(w + wallThickness / 2, h / 2, wallThickness, h * 3, { isStatic: true, friction: 0.5 }),
    ];
    Matter.Composite.add(engine.world, walls);

    // Disable gyro until bottle lands
    const landCheck = setInterval(() => {
      const b = bottleBodyRef.current;
      if (b && b.position.y > floorY - renderH && Math.abs(b.velocity.y) < 0.5) {
        landedRef.current = true;
        clearInterval(landCheck);
      }
    }, 100);

    return () => {
      clearInterval(landCheck);
      Matter.Engine.clear(engine);
      if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current);
    };
  }, [dims]);

  // Gyro — tilts gravity only after bottle has landed
  const lastTiltRef = useRef(0);
  const handleOrientation = useCallback((e) => {
    if (e.gamma === null || !engineRef.current || !landedRef.current) return;
    const p = DEFAULT_PARAMS;
    let tiltX = e.gamma / 90;
    tiltX = Math.max(-1, Math.min(1, tiltX));
    if (Math.abs(tiltX) < 0.04) tiltX = 0;

    const gravity = engineRef.current.gravity;
    gravity.x = tiltX * p.gravityScale;
    gravity.y = p.gravity;

    // Sleeping bodies ignore gravity changes — wake the bottle when
    // the tilt meaningfully changes
    if (Math.abs(tiltX - lastTiltRef.current) > 0.03) {
      lastTiltRef.current = tiltX;
      const b = bottleBodyRef.current;
      if (b && b.isSleeping) Matter.Sleeping.set(b, false);
    }
  }, []);

  // Enable gyro on touch
  const gyroEnabledRef = useRef(false);
  const enableGyro = useCallback(async () => {
    if (gyroEnabledRef.current) return;
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
          gyroEnabledRef.current = true;
        }
      } else {
        window.addEventListener('deviceorientation', handleOrientation);
        gyroEnabledRef.current = true;
      }
    } catch (e) { /* denied */ }
  }, [handleOrientation]);

  // Probe for existing permission
  useEffect(() => {
    let probeListener;
    const probe = () => {
      gyroEnabledRef.current = true;
      window.removeEventListener('deviceorientation', probeListener);
      window.addEventListener('deviceorientation', handleOrientation);
    };
    probeListener = probe;
    window.addEventListener('deviceorientation', probeListener);
    const timeout = setTimeout(() => {
      window.removeEventListener('deviceorientation', probeListener);
    }, 500);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('deviceorientation', probeListener);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [handleOrientation]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const fluidCanvas = fluidCanvasRef.current;
    if (!canvas || !fluidCanvas) return;
    const { w, h } = dims;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Fluid canvas: SMALL, bottle-sized (+ padding for goo blur spread).
    // It gets positioned over the bottle with a CSS transform (GPU-cheap),
    // so the goo filter only processes this small area — same cost as the
    // vodka screen instead of a full-screen blur.
    const PAD = 30;
    const fcw = Math.ceil(renderW + PAD * 2);
    const fch = Math.ceil(renderH + PAD * 2);
    fluidCanvas.width = fcw * dpr;
    fluidCanvas.height = fch * dpr;
    fluidCanvas.style.width = `${fcw}px`;
    fluidCanvas.style.height = `${fch}px`;
    const fctx = fluidCanvas.getContext('2d');
    fctx.scale(dpr, dpr);

    const off = imgOffsetRef.current;
    let fluidDirty = true;

    const loop = () => {
      const engine = engineRef.current;
      if (!engine) { renderLoopRef.current = requestAnimationFrame(loop); return; }

      Matter.Engine.update(engine, 1000 / 60);

      ctx.clearRect(0, 0, w, h);

      const bottle = bottleBodyRef.current;
      const img = bottleImgRef.current;
      if (bottle && img) {
        const pos = bottle.position;
        const angle = bottle.angle;
        const offNow = imgOffsetRef.current;

        // --- Fluid: simulate in bottle-local frame with rotated gravity ---
        const particles = fluidRef.current;
        const sleep = fluidSleepRef.current;
        if (particles) {
          const g = engine.gravity;
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          const glx = (g.x * cosA + g.y * sinA) * FLUID_GRAVITY;
          const gly = (-g.x * sinA + g.y * cosA) * FLUID_GRAVITY;
          const wasSleeping = sleep.sleeping;
          simulateFluid(particles, glx, gly, sleep);
          if (!sleep.sleeping || wasSleeping !== sleep.sleeping) fluidDirty = true;

          // Only redraw fluid pixels when the sim actually moved
          if (fluidDirty) {
            fctx.clearRect(0, 0, fcw, fch);
            fctx.fillStyle = 'rgba(255, 244, 170, 0.9)';
            const r = PARTICLE_RADIUS * 2 * (renderW / FW);
            const cx = fcw / 2 + offNow.x;
            const cy = fch / 2 + offNow.y;
            for (const fp of particles) {
              const px = cx + (fp.x / FW - 0.5) * renderW;
              const py = cy + (fp.y / FH - 0.5) * renderH;
              fctx.beginPath();
              fctx.arc(px, py, r, 0, Math.PI * 2);
              fctx.fill();
            }
            fluidDirty = !sleep.sleeping ? true : false;
          }

          // Position the small canvas over the bottle (GPU transform, no redraw)
          fluidCanvas.style.transform =
            `translate(${pos.x - fcw / 2}px, ${pos.y - fch / 2}px) rotate(${angle}rad)`;
        }

        // --- Bottle artwork on the top canvas ---
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(angle);
        ctx.drawImage(img, offNow.x - renderW / 2, offNow.y - renderH / 2, renderW, renderH);
        ctx.restore();

        // Debug: red dot at center of mass
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 40, 40, 0.9)';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      renderLoopRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => { if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current); };
  }, [dims]);

  return (
    <div className="liquid-bottle-container">
      <div
        className="liquid-bottle-wrapper"
        ref={containerRef}
        style={{ touchAction: 'none' }}
      >
        {/* SVG goo filter for the fluid canvas */}
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <filter id="bottle-goo">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
                result="goo"
              />
            </filter>
          </defs>
        </svg>
        {/* Fluid canvas: small bottle-sized surface, positioned over the
            bottle each frame via CSS transform. Goo filter only processes
            this small area — same cost profile as the vodka screen. */}
        <canvas
          ref={fluidCanvasRef}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            zIndex: 1,
            filter: 'url(#bottle-goo)',
            willChange: 'transform',
          }}
        />
        {/* Bottle + physics canvas on top */}
        <canvas
          ref={canvasRef}
          onTouchStart={() => { if (!gyroEnabledRef.current) enableGyro(); }}
          onClick={() => { if (!gyroEnabledRef.current) enableGyro(); }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100dvh',
            zIndex: 2,
          }}
        />
      </div>
    </div>
  );
}

export default BottlePhysics;
