import { useRef, useEffect, useCallback, useState } from 'react';
import Matter from 'matter-js';

/**
 * BottlePhysics — Prototype: bottle as a rigid body that tips with gyro.
 * Trapped within viewport bounds (floor, ceiling, walls).
 * Gyro tilts gravity so the bottle falls over when phone is tilted.
 */

const BOTTLE_IMG = '/bottle-nolabel.png';

// Vertices in image-fraction space, relative to image center.
// From pixel trace: cork top at 6% of image height (-0.44 centered),
// bottle bottom at ~92% (+0.42 centered), body width ~±0.21, neck ~±0.08.
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

// Bottle INTERIOR half-width profile (definition-space fractions, inset from glass).
// Given a y fraction, returns the max |x| fraction a particle can occupy.
function interiorHalfWidth(yFrac) {
  if (yFrac < -0.34) return 0;              // above neck opening — sealed by cork
  if (yFrac < -0.17) return 0.055;          // neck
  if (yFrac < -0.02) {                      // shoulder — widens linearly
    const t = (yFrac + 0.17) / 0.15;
    return 0.055 + t * (0.175 - 0.055);
  }
  if (yFrac < 0.36) return 0.175;           // body
  if (yFrac < 0.40) {                       // bottom curve — narrows slightly
    const t = (yFrac - 0.36) / 0.04;
    return 0.175 - t * 0.02;
  }
  return 0;
}

const FLUID_BOTTOM = 0.40;  // definition-space y of interior floor
const FLUID_DAMPING = 0.94;

// Cheap particle sim: gravity + pairwise repulsion + boundary clamp.
// All coords in definition space scaled by render size.
function simulateFluid(particles, gx, gy, renderW, renderH) {
  const n = particles.length;
  const r = renderW * 0.055;          // particle radius (px)
  const minDist = r * 1.7;
  const minDist2 = minDist * minDist;

  for (let i = 0; i < n; i++) {
    const p = particles[i];
    p.vx = (p.vx + gx) * FLUID_DAMPING;
    p.vy = (p.vy + gy) * FLUID_DAMPING;
    p.x += p.vx;
    p.y += p.vy;
  }

  // Pairwise repulsion (n is small enough for O(n^2))
  for (let i = 0; i < n; i++) {
    const a = particles[i];
    for (let j = i + 1; j < n; j++) {
      const b = particles[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < minDist2 && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (minDist - d) * 0.3;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
      }
    }
  }

  // Boundary clamp — bottle interior in local frame
  for (let i = 0; i < n; i++) {
    const p = particles[i];
    let yF = p.y / renderH;
    // floor / ceiling
    if (yF > FLUID_BOTTOM) { p.y = FLUID_BOTTOM * renderH; p.vy *= -0.2; yF = FLUID_BOTTOM; }
    if (yF < -0.34) { p.y = -0.34 * renderH; p.vy *= -0.2; yF = -0.34; }
    // side walls at this height (profile fractions share the vertex x-space: * renderW)
    const lim = interiorHalfWidth(yF) * renderW;
    if (p.x > lim) { p.x = lim; p.vx *= -0.2; }
    if (p.x < -lim) { p.x = -lim; p.vx *= -0.2; }
  }
}

// Standard, realistic physics defaults
const DEFAULT_PARAMS = {
  gravity: 1.0,        // Matter.js default earth-like gravity
  friction: 0.5,       // typical glass-on-wood sliding friction
  frictionStatic: 0.8, // slightly higher static than kinetic (standard)
  frictionAir: 0.01,   // Matter.js default air drag
  restitution: 0.2,    // glass bottles don't bounce much
  density: 0.002,      // moderate mass
  gravityScale: 1.0,   // 1:1 tilt-to-gravity mapping
};

function BottlePhysics() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const bottleBodyRef = useRef(null);
  const renderLoopRef = useRef(null);
  const bottleImgRef = useRef(null);
  const imgOffsetRef = useRef({ x: 0, y: 0 });
  const fluidRef = useRef(null);
  const [dims, setDims] = useState({ w: 320, h: 560 });

  // Load bottle image
  useEffect(() => {
    const img = new Image();
    img.src = BOTTLE_IMG;
    img.onload = () => { bottleImgRef.current = img; };
  }, []);

  // Measure container — use actual visible viewport for physics
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Use clientWidth to avoid scrollbar/safe-area issues
    const w = document.documentElement.clientWidth;
    const h = window.innerHeight;
    setDims({ w, h, wrapperRect: rect });
  }, []);

  // Bottle render size: same as old 42vh bottle
  const renderH = window.innerHeight * 0.42;
  const renderW = renderH * (2 / 3);

  // Track whether bottle has landed (gyro disabled until then)
  const landedRef = useRef(false);

  // Initialize physics
  useEffect(() => {
    const { w, h } = dims;
    const p = DEFAULT_PARAMS;
    const engine = Matter.Engine.create();
    engine.gravity.y = p.gravity;
    engine.gravity.x = 0;
    engineRef.current = engine;

    // Create bottle body — starts just above screen (bottom of bottle at y=0)
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
      // My vertices are defined relative to the IMAGE CENTER, but Matter.js
      // repositions the body at the shape's centroid (of the hull it actually built).
      // Compute the exact offset by comparing the body's world bounds (at angle 0)
      // against my definition-space bounds. Works regardless of hull/decomposition.
      const defMinX = Math.min(...vertices.map(v => v.x));
      const defMinY = Math.min(...vertices.map(v => v.y));
      // centroid position in definition space:
      const cX = defMinX - (bottle.bounds.min.x - bottle.position.x);
      const cY = defMinY - (bottle.bounds.min.y - bottle.position.y);

      // Center of mass slightly below the shoulder line — stable but tippable.
      const COM_Y = 0.06 * renderH; // definition-space target
      Matter.Body.setCentre(bottle, { x: 0 - cX, y: COM_Y - cY }, true);

      // Image center (definition origin) relative to new body position:
      imgOffsetRef.current = { x: 0, y: -COM_Y };

      bottleBodyRef.current = bottle;
      Matter.Composite.add(engine.world, bottle);

      // Initialize fluid particles on a grid inside the bottle (~80% fill)
      const fluid = [];
      const spacing = renderW * 0.075;
      for (let y = FLUID_BOTTOM * renderH - spacing / 2; y > -0.10 * renderH; y -= spacing) {
        const lim = interiorHalfWidth(y / renderH) * renderW - spacing / 2;
        for (let x = -lim; x <= lim; x += spacing) {
          fluid.push({ x, y, vx: 0, vy: 0 });
        }
      }
      fluidRef.current = fluid;
    }

    // Walls — flush with visible screen edges
    const wallThickness = 60;
    const walls = [
      // Floor
      Matter.Bodies.rectangle(w / 2, floorY + wallThickness / 2, w * 3, wallThickness, { isStatic: true, friction: p.friction, frictionStatic: p.frictionStatic }),
      // Left wall — inner face at x=0
      Matter.Bodies.rectangle(-wallThickness / 2, h / 2, wallThickness, h * 3, { isStatic: true, friction: 0.5 }),
      // Right wall — inner face at x=w
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
  const handleOrientation = useCallback((e) => {
    if (e.gamma === null || !engineRef.current || !landedRef.current) return;
    const p = DEFAULT_PARAMS;
    let tiltX = e.gamma / 90;
    tiltX = Math.max(-1, Math.min(1, tiltX));
    if (Math.abs(tiltX) < 0.04) tiltX = 0;

    const gravity = engineRef.current.gravity;
    gravity.x = tiltX * p.gravityScale;
    gravity.y = p.gravity;
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
    if (!canvas) return;
    const { w, h } = dims;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

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

        const off = imgOffsetRef.current;

        // --- Fluid simulation in the bottle's local frame ---
        // Particles live in definition-space coords; the boundary never moves
        // in this frame so the liquid can never escape the bottle.
        const particles = fluidRef.current;
        if (particles) {
          const g = engine.gravity;
          // Rotate world gravity into the bottle's local frame
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          const glx = (g.x * cosA + g.y * sinA) * 0.25;
          const gly = (-g.x * sinA + g.y * cosA) * 0.25;
          simulateFluid(particles, glx, gly, renderW, renderH);

          // Draw particles inside the rotated bottle frame, under the artwork
          ctx.save();
          ctx.translate(pos.x, pos.y);
          ctx.rotate(angle);
          ctx.fillStyle = 'rgba(255, 244, 170, 0.9)';
          const pr = renderW * 0.055;
          for (const fp of particles) {
            ctx.beginPath();
            ctx.arc(off.x + fp.x, off.y + fp.y, pr, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // Bottle artwork on top of the liquid
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(angle);
        ctx.drawImage(img, off.x - renderW / 2, off.y - renderH / 2, renderW, renderH);
        ctx.restore();
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
        {/* Full-screen canvas for bottle physics */}
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
            zIndex: 1,
          }}
        />
      </div>
    </div>
  );
}

export default BottlePhysics;
