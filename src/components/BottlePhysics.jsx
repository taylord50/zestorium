import { useRef, useEffect, useCallback, useState } from 'react';
import Matter from 'matter-js';

/**
 * BottlePhysics — Prototype: bottle as a rigid body that tips with gyro.
 * Trapped within viewport bounds (floor, ceiling, walls).
 * Gyro tilts gravity so the bottle falls over when phone is tilted.
 */

const BOTTLE_IMG = '/bottle-nolabel.png';

const RENDER_W = 90;
const RENDER_H = 135;

// Bottle collision polygon (convex hull approximation)
const BOTTLE_VERTICES = [
  { x: -0.12, y: -0.50 },
  { x: 0.12, y: -0.50 },
  { x: 0.12, y: -0.30 },
  { x: 0.15, y: -0.25 },
  { x: 0.30, y: -0.15 },
  { x: 0.38, y: -0.05 },
  { x: 0.40, y: 0.05 },
  { x: 0.40, y: 0.40 },
  { x: 0.38, y: 0.48 },
  { x: 0.30, y: 0.50 },
  { x: -0.30, y: 0.50 },
  { x: -0.38, y: 0.48 },
  { x: -0.40, y: 0.40 },
  { x: -0.40, y: 0.05 },
  { x: -0.38, y: -0.05 },
  { x: -0.30, y: -0.15 },
  { x: -0.15, y: -0.25 },
  { x: -0.12, y: -0.30 },
];

const DEFAULT_PARAMS = {
  gravity: 1.5,
  friction: 0.8,
  frictionStatic: 1.5,
  frictionAir: 0.01,
  restitution: 0.15,
  density: 0.004,
  gravityScale: 2.0,
};

function BottlePhysics() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const bottleBodyRef = useRef(null);
  const renderLoopRef = useRef(null);
  const bottleImgRef = useRef(null);
  const [dims, setDims] = useState({ w: 320, h: 560 });
  const [params, setParams] = useState({ ...DEFAULT_PARAMS });
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // Load bottle image
  useEffect(() => {
    const img = new Image();
    img.src = BOTTLE_IMG;
    img.onload = () => { bottleImgRef.current = img; };
  }, []);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDims({ w: rect.width, h: rect.height });
  }, []);

  // Initialize physics
  useEffect(() => {
    const { w, h } = dims;
    const p = paramsRef.current;
    const engine = Matter.Engine.create();
    engine.gravity.y = p.gravity;
    engine.gravity.x = 0;
    engineRef.current = engine;

    // Create bottle body — starts upright, centered horizontally, resting on floor
    const vertices = BOTTLE_VERTICES.map(v => ({
      x: v.x * RENDER_W,
      y: v.y * RENDER_H,
    }));

    const bottle = Matter.Bodies.fromVertices(w / 2, h - RENDER_H / 2 - 5, [vertices], {
      restitution: p.restitution,
      friction: p.friction,
      frictionStatic: p.frictionStatic,
      frictionAir: p.frictionAir,
      density: p.density,
      render: { visible: false },
    });

    if (bottle) {
      bottleBodyRef.current = bottle;
      Matter.Composite.add(engine.world, bottle);
    }

    // Walls — trap the bottle
    const wallThickness = 60;
    const walls = [
      Matter.Bodies.rectangle(w / 2, h + wallThickness / 2, w + 100, wallThickness, { isStatic: true, friction: p.friction, frictionStatic: p.frictionStatic }),
      Matter.Bodies.rectangle(w / 2, -wallThickness / 2, w + 100, wallThickness, { isStatic: true }),
      Matter.Bodies.rectangle(-wallThickness / 2, h / 2, wallThickness, h + 100, { isStatic: true }),
      Matter.Bodies.rectangle(w + wallThickness / 2, h / 2, wallThickness, h + 100, { isStatic: true }),
    ];
    Matter.Composite.add(engine.world, walls);

    return () => {
      Matter.Engine.clear(engine);
      if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current);
    };
  }, [dims]);

  // Gyro — tilts gravity
  const handleOrientation = useCallback((e) => {
    if (e.gamma === null || !engineRef.current) return;
    const p = paramsRef.current;
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

  // Update physics params on existing body
  useEffect(() => {
    const bottle = bottleBodyRef.current;
    if (!bottle) return;
    bottle.friction = params.friction;
    bottle.frictionStatic = params.frictionStatic;
    bottle.frictionAir = params.frictionAir;
    bottle.restitution = params.restitution;
    if (engineRef.current) {
      engineRef.current.gravity.y = params.gravity;
    }
  }, [params]);

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

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(angle);
        ctx.drawImage(img, -RENDER_W / 2, -RENDER_H / 2, RENDER_W, RENDER_H);
        ctx.restore();
      }

      renderLoopRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => { if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current); };
  }, [dims]);

  const updateParam = (key, val) => {
    setParams(prev => ({ ...prev, [key]: parseFloat(val) }));
  };

  const sliders = [
    { key: 'gravity', min: 0.5, max: 4, step: 0.1, label: 'Gravity' },
    { key: 'gravityScale', min: 0.5, max: 5, step: 0.1, label: 'Tilt Sensitivity' },
    { key: 'friction', min: 0, max: 2, step: 0.05, label: 'Friction' },
    { key: 'frictionStatic', min: 0, max: 3, step: 0.1, label: 'Static Friction' },
    { key: 'frictionAir', min: 0, max: 0.1, step: 0.005, label: 'Air Resistance' },
    { key: 'restitution', min: 0, max: 1, step: 0.05, label: 'Bounciness' },
    { key: 'density', min: 0.001, max: 0.02, step: 0.001, label: 'Density' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', width: '100%', background: '#FBF8F1' }}>
      {/* Main bottle area */}
      <div
        ref={containerRef}
        onTouchStart={() => { if (!gyroEnabledRef.current) enableGyro(); }}
        onClick={() => { if (!gyroEnabledRef.current) enableGyro(); }}
        style={{
          flex: 1,
          position: 'relative',
          touchAction: 'none',
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
        {/* Overlay text like home screen */}
        <div style={{ position: 'absolute', top: '0.5rem', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 400, color: '#2A2A2A' }}>Zestorium</h1>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', color: '#2A2A2A', marginTop: '0.25rem' }}>
            Three ingredients. One week.<br />Your own limoncello.
          </p>
        </div>
        <p style={{ position: 'absolute', bottom: '1rem', left: 0, right: 0, textAlign: 'center', color: '#999', fontSize: '0.75rem', pointerEvents: 'none' }}>
          Tilt your phone to tip the bottle
        </p>
      </div>

      {/* Debug tuning panel — compact at bottom */}
      <div style={{ padding: '8px 12px', background: '#fff', borderTop: '1px solid #ddd', fontSize: 11, overflowY: 'auto', maxHeight: '30vh' }}>
        <strong style={{ fontSize: 12 }}>Bottle Physics</strong>
        {sliders.map(({ key, min, max, step, label }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ width: 90, fontWeight: 600 }}>{label}</span>
            <input
              type="range" min={min} max={max} step={step}
              value={params[key]}
              onChange={(e) => updateParam(key, e.target.value)}
              style={{ flex: 1 }}
            />
            <span style={{ width: 40, fontFamily: 'monospace', textAlign: 'right' }}>{params[key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BottlePhysics;
