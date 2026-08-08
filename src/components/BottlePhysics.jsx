import { useRef, useEffect, useCallback, useState } from 'react';
import Matter from 'matter-js';

/**
 * BottlePhysics — Prototype: bottle as a rigid body that tips with gyro.
 * Trapped within viewport bounds (floor, ceiling, walls).
 * Gyro tilts gravity so the bottle falls over when phone is tilted.
 */

const BOTTLE_IMG = '/bottle-nolabel.png';

// Bottle collision polygon — traced from actual bottle edge pixels
// Coordinates as fractions from center (-0.5 to 0.5 range)
// Bottom is flattened for stability
const BOTTLE_VERTICES = [
  // Top of neck — lowered to split the cork curve
  { x: -0.084, y: -0.40 },
  { x: 0.063, y: -0.40 },
  // Neck
  { x: 0.068, y: -0.38 },
  { x: 0.078, y: -0.38 },
  { x: 0.072, y: -0.30 },
  { x: 0.073, y: -0.23 },
  // Shoulder transition
  { x: 0.080, y: -0.18 },
  { x: 0.169, y: -0.13 },
  { x: 0.201, y: -0.08 },
  // Body right
  { x: 0.204, y: -0.05 },
  { x: 0.203, y: 0.0 },
  { x: 0.202, y: 0.10 },
  { x: 0.203, y: 0.20 },
  { x: 0.203, y: 0.30 },
  { x: 0.203, y: 0.37 },
  // Bottom right corner
  { x: 0.200, y: 0.39 },
  // Flat bottom
  { x: 0.163, y: 0.41 },
  { x: -0.163, y: 0.41 },
  // Bottom left corner
  { x: -0.200, y: 0.39 },
  // Body left
  { x: -0.205, y: 0.37 },
  { x: -0.205, y: 0.30 },
  { x: -0.207, y: 0.20 },
  { x: -0.207, y: 0.10 },
  { x: -0.212, y: 0.0 },
  { x: -0.211, y: -0.05 },
  // Shoulder left
  { x: -0.179, y: -0.08 },
  { x: -0.148, y: -0.13 },
  { x: -0.098, y: -0.18 },
  // Neck left
  { x: -0.092, y: -0.23 },
  { x: -0.091, y: -0.30 },
  { x: -0.089, y: -0.38 },
  { x: -0.084, y: -0.40 },
];

const DEFAULT_PARAMS = {
  gravity: 2.0,
  friction: 0.95,
  frictionStatic: 50,
  frictionAir: 0.005,
  restitution: 0.1,
  density: 0.005,
  gravityScale: 1.5,
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
      bottleBodyRef.current = bottle;
      Matter.Composite.add(engine.world, bottle);
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

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(angle);
        ctx.drawImage(img, -renderW / 2, -renderH / 2, renderW, renderH);
        ctx.restore();

        // Debug: fill collision polygon in translucent blue
        const vertices = bottle.vertices;
        if (vertices && vertices.length > 0) {
          ctx.beginPath();
          ctx.moveTo(vertices[0].x, vertices[0].y);
          for (let i = 1; i < vertices.length; i++) {
            ctx.lineTo(vertices[i].x, vertices[i].y);
          }
          ctx.closePath();
          ctx.fillStyle = 'rgba(100, 180, 255, 0.3)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(100, 180, 255, 0.7)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
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
