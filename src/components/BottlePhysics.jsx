import { useRef, useEffect, useCallback, useState } from 'react';
import Matter from 'matter-js';

/**
 * BottlePhysics — Prototype: bottle as a rigid body that tips with gyro.
 * Trapped within viewport bounds (floor, ceiling, walls).
 * Gyro tilts gravity so the bottle falls over when phone is tilted.
 */

const BOTTLE_IMG = '/bottle-nolabel.png';

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

  // Bottle render size: fill the container (which is 42vh via CSS)
  const renderH = dims.h * 0.9;
  const renderW = renderH * (2 / 3);

  // Initialize physics
  useEffect(() => {
    const { w, h } = dims;
    const p = DEFAULT_PARAMS;
    const engine = Matter.Engine.create();
    engine.gravity.y = p.gravity;
    engine.gravity.x = 0;
    engineRef.current = engine;

    // Create bottle body — starts above screen, falls in
    const vertices = BOTTLE_VERTICES.map(v => ({
      x: v.x * renderW,
      y: v.y * renderH,
    }));

    const bottle = Matter.Bodies.fromVertices(w / 2, -renderH, [vertices], {
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

    // Walls — floor at bottom of wrapper, left/right at screen edges
    // The canvas maps to the wrapper dimensions, but we want walls at actual screen edges
    // Screen width in canvas coordinates: screen is wider than wrapper
    const screenW = window.innerWidth;
    const wrapperW = w; // canvas/wrapper width
    const extraSide = ((screenW - wrapperW) / 2) * (w / wrapperW); // extra space in canvas coords
    const wallThickness = 60;
    const walls = [
      // Floor
      Matter.Bodies.rectangle(w / 2, h + wallThickness / 2, screenW + 200, wallThickness, { isStatic: true, friction: p.friction, frictionStatic: p.frictionStatic }),
      // Left wall at screen edge
      Matter.Bodies.rectangle(-extraSide - wallThickness / 2, h / 2, wallThickness, h * 3, { isStatic: true }),
      // Right wall at screen edge
      Matter.Bodies.rectangle(w + extraSide + wallThickness / 2, h / 2, wallThickness, h * 3, { isStatic: true }),
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

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(angle);
        ctx.drawImage(img, -renderW / 2, -renderH / 2, renderW, renderH);
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
        onTouchStart={() => { if (!gyroEnabledRef.current) enableGyro(); }}
        onClick={() => { if (!gyroEnabledRef.current) enableGyro(); }}
        style={{ touchAction: 'none', overflow: 'visible' }}
      >
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
        />
      </div>
    </div>
  );
}

export default BottlePhysics;
