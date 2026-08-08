import { useRef, useEffect, useCallback, useState } from 'react';
import Matter from 'matter-js';

/**
 * BottlePhysics — Prototype: bottle as a rigid body that tips with gyro.
 * Trapped within viewport bounds (floor, ceiling, walls).
 * Gyro tilts gravity so the bottle falls over when phone is tilted.
 */

const BOTTLE_IMG = '/bottle-nolabel.png';

// Bottle shape: simplified convex polygon traced from bottle outline
// Coordinates relative to center, scaled to render size
// The bottle image is 1024x1536, we'll render at ~90px wide x 135px tall
const RENDER_W = 90;
const RENDER_H = 135;

// Bottle collision polygon (convex hull approximation)
// Points as fractions of RENDER_W/RENDER_H from center
const BOTTLE_VERTICES = [
  // Top of neck (narrow)
  { x: -0.12, y: -0.50 },
  { x: 0.12, y: -0.50 },
  // Neck widens
  { x: 0.12, y: -0.30 },
  { x: 0.15, y: -0.25 },
  // Shoulder
  { x: 0.30, y: -0.15 },
  { x: 0.38, y: -0.05 },
  // Body
  { x: 0.40, y: 0.05 },
  { x: 0.40, y: 0.40 },
  // Bottom
  { x: 0.38, y: 0.48 },
  { x: 0.30, y: 0.50 },
  { x: -0.30, y: 0.50 },
  { x: -0.38, y: 0.48 },
  // Body left
  { x: -0.40, y: 0.40 },
  { x: -0.40, y: 0.05 },
  // Shoulder left
  { x: -0.38, y: -0.05 },
  { x: -0.30, y: -0.15 },
  // Neck left
  { x: -0.15, y: -0.25 },
  { x: -0.12, y: -0.30 },
];

function BottlePhysics() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const bottleBodyRef = useRef(null);
  const renderLoopRef = useRef(null);
  const bottleImgRef = useRef(null);
  const [dims, setDims] = useState({ w: 320, h: 560 });

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
    const engine = Matter.Engine.create();
    engine.gravity.y = 1.5;
    engine.gravity.x = 0;
    engineRef.current = engine;

    // Create bottle body from polygon
    const vertices = BOTTLE_VERTICES.map(v => ({
      x: v.x * RENDER_W,
      y: v.y * RENDER_H,
    }));

    const bottle = Matter.Bodies.fromVertices(w / 2, h * 0.55, [vertices], {
      restitution: 0.2,
      friction: 0.6,
      frictionAir: 0.01,
      density: 0.004,
      render: { visible: false },
    });

    if (bottle) {
      bottleBodyRef.current = bottle;
      Matter.Composite.add(engine.world, bottle);
    }

    // Walls — trap the bottle inside the viewport
    const wallThickness = 60;
    const walls = [
      // Floor
      Matter.Bodies.rectangle(w / 2, h + wallThickness / 2, w + 100, wallThickness, { isStatic: true, friction: 0.8 }),
      // Ceiling
      Matter.Bodies.rectangle(w / 2, -wallThickness / 2, w + 100, wallThickness, { isStatic: true }),
      // Left wall
      Matter.Bodies.rectangle(-wallThickness / 2, h / 2, wallThickness, h + 100, { isStatic: true }),
      // Right wall
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
    // gamma: left/right tilt (-90 to 90)
    // beta: front/back tilt (-180 to 180)
    let tiltX = e.gamma / 90; // -1 to 1
    let tiltY = (e.beta - 45) / 90; // normalized around holding phone at ~45deg
    tiltX = Math.max(-1, Math.min(1, tiltX));
    tiltY = Math.max(-1, Math.min(1, tiltY));

    // Deadband
    if (Math.abs(tiltX) < 0.05) tiltX = 0;

    const gravity = engineRef.current.gravity;
    gravity.x = tiltX * 2;
    gravity.y = 0.5 + tiltY * 1.5; // always some downward gravity, more when tilted forward
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

  // Probe for existing permission on mount
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

  return (
    <div
      ref={containerRef}
      onTouchStart={() => { if (!gyroEnabledRef.current) enableGyro(); }}
      onClick={() => { if (!gyroEnabledRef.current) enableGyro(); }}
      style={{
        width: '100%',
        height: '100dvh',
        position: 'relative',
        touchAction: 'none',
        background: '#FBF8F1',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      <p style={{
        position: 'absolute',
        bottom: '2rem',
        left: 0,
        right: 0,
        textAlign: 'center',
        color: '#999',
        fontSize: '0.8rem',
      }}>
        Tilt your phone to tip the bottle
      </p>
    </div>
  );
}

export default BottlePhysics;
