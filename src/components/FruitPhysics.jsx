import { useState, useRef, useEffect, useCallback } from 'react';
import Matter from 'matter-js';
import { CITRUS_DATA } from '../config/citrusData';

/**
 * FruitPhysics — Matter.js physics with real fruit PNG rendering.
 * Tap to add, drag to move, fling off edge to remove.
 * Tilt enabled automatically on devices with gyro.
 */

const CANVAS_W = 320;
const CANVAS_H = 384;

// Fruit image data: bounding boxes for cropping the PNG sprites
const FRUIT_DATA = {
  lemon: {
    img: '/fruit-lemon.png',
    bbox: { x: 161, y: 232, w: 712, h: 518 },
    rx: 356, ry: 259,
  },
  lime: {
    img: '/fruit-lime.png',
    bbox: { x: 192, y: 231, w: 648, h: 508 },
    rx: 324, ry: 254,
  },
  orange: {
    img: '/fruit-orange.png',
    bbox: { x: 195, y: 201, w: 637, h: 576 },
    rx: 318, ry: 288,
  },
  grapefruit: {
    img: '/fruit-grapefruit.png',
    bbox: { x: 204, y: 203, w: 623, h: 575 },
    rx: 312, ry: 288,
  },
};

// Tuned physics parameters (from debug tuning session)
const PARAMS = {
  fruitScale: 0.12,
  gravity: 1.0,
  restitution: 0.6,
  friction: 0.2,
  frictionAir: 0.005,
  flingMultiplier: 0.05,
  density: 0.0076,
  slop: 0.05,
};

// Per-fruit size/deformation settings
const FRUIT_VARIATION = {
  lemon: { sizeVariation: 10, deformation: 15 },
  lime: { sizeVariation: 10, deformation: 15 },
  orange: { sizeVariation: 10, deformation: 5 },
  grapefruit: { sizeVariation: 10, deformation: 5 },
};

function FruitPhysics({ citrusType, onConfirm }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const renderLoopRef = useRef(null);
  const fruitsRef = useRef([]);
  const dragRef = useRef(null);
  const [count, setCount] = useState(0);
  const fruitImgRef = useRef(null);

  const fruitDef = FRUIT_DATA[citrusType] || FRUIT_DATA.lemon;
  const variation = FRUIT_VARIATION[citrusType] || FRUIT_VARIATION.lemon;
  const citrus = CITRUS_DATA[citrusType];

  // Load fruit image
  useEffect(() => {
    const img = new Image();
    img.src = fruitDef.img;
    img.onload = () => { fruitImgRef.current = img; };
    return () => { fruitImgRef.current = null; };
  }, [citrusType]);

  // Initialize Matter.js engine
  useEffect(() => {
    const engine = Matter.Engine.create();
    engine.gravity.y = PARAMS.gravity;
    engineRef.current = engine;

    const wallThickness = 50;
    const walls = [
      // floor
      Matter.Bodies.rectangle(CANVAS_W / 2, CANVAS_H + wallThickness / 2 - 5, CANVAS_W + 100, wallThickness, { isStatic: true }),
      // left wall
      Matter.Bodies.rectangle(-wallThickness / 2 + 5, CANVAS_H / 2, wallThickness, CANVAS_H + 100, { isStatic: true }),
      // right wall
      Matter.Bodies.rectangle(CANVAS_W + wallThickness / 2 - 5, CANVAS_H / 2, wallThickness, CANVAS_H + 100, { isStatic: true }),
    ];
    Matter.Composite.add(engine.world, walls);

    return () => {
      Matter.Engine.clear(engine);
      if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current);
    };
  }, []);

  // Auto-enable tilt
  const handleOrientation = useCallback((e) => {
    if (e.gamma === null || !engineRef.current) return;
    let tiltX = e.gamma / 90;
    if (Math.abs(tiltX) < 0.06) tiltX = 0;
    tiltX = Math.max(-1, Math.min(1, tiltX));
    engineRef.current.gravity.x = tiltX * PARAMS.gravity * 2;
  }, []);

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
    } catch (e) {
      // Permission failed — will retry on next user gesture
    }
  }, [handleOrientation]);

  // On mount: probe for existing permission by listening for events directly
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

  // Add a fruit at position
  const addFruit = (x, y) => {
    const engine = engineRef.current;
    if (!engine) return;

    const sizeRandom = 1 + ((Math.random() * 2 - 1) * (variation.sizeVariation / 100));
    const deformRandom = 1 + ((Math.random() * 2 - 1) * (variation.deformation / 100));
    const scaleRx = fruitDef.rx * PARAMS.fruitScale * sizeRandom * deformRandom;
    const scaleRy = fruitDef.ry * PARAMS.fruitScale * sizeRandom;

    // Ellipse polygon (20 vertices)
    const vertices = [];
    const numSides = 20;
    for (let i = 0; i < numSides; i++) {
      const angle = (i / numSides) * Math.PI * 2;
      vertices.push({
        x: Math.cos(angle) * scaleRx,
        y: Math.sin(angle) * scaleRy,
      });
    }

    const body = Matter.Bodies.fromVertices(x, y, [vertices], {
      restitution: PARAMS.restitution,
      friction: PARAMS.friction,
      frictionAir: PARAMS.frictionAir,
      density: PARAMS.density,
      slop: PARAMS.slop,
      render: { visible: false },
    });

    if (!body) return;

    Matter.Composite.add(engine.world, body);
    fruitsRef.current.push({ body, scaleRx, scaleRy });
    setCount(fruitsRef.current.length);
  };

  // Remove fruits that are off screen
  const cleanupFruits = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const fruits = fruitsRef.current;
    for (let i = fruits.length - 1; i >= 0; i--) {
      const pos = fruits[i].body.position;
      if (pos.y > CANVAS_H + 100 || pos.y < -200 || pos.x < -100 || pos.x > CANVAS_W + 100) {
        Matter.Composite.remove(engine.world, fruits[i].body);
        fruits.splice(i, 1);
        setCount(fruits.length);
      }
    }
  };

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.scale(dpr, dpr);

    const loop = () => {
      const engine = engineRef.current;
      if (!engine) { renderLoopRef.current = requestAnimationFrame(loop); return; }

      Matter.Engine.update(engine, 1000 / 60);
      cleanupFruits();

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      const img = fruitImgRef.current;
      const bb = fruitDef.bbox;

      for (const { body, scaleRx, scaleRy } of fruitsRef.current) {
        const pos = body.position;
        const angle = body.angle;

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(angle);

        if (img && bb) {
          ctx.drawImage(
            img,
            bb.x, bb.y, bb.w, bb.h,
            -scaleRx, -scaleRy, scaleRx * 2, scaleRy * 2
          );
        } else {
          ctx.beginPath();
          ctx.ellipse(0, 0, scaleRx, scaleRy, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#ccc';
          ctx.fill();
        }
        ctx.restore();
      }

      renderLoopRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => { if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current); };
  }, [citrusType]);

  // Pointer: tap to add, drag to move, fling to remove
  const handlePointerDown = (e) => {
    if (!gyroEnabledRef.current) enableGyro();
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const engine = engineRef.current;
    if (!engine) return;

    // Check if clicking on existing fruit
    const bodies = Matter.Composite.allBodies(engine.world);
    const clickedBody = bodies.find(b => !b.isStatic && Matter.Bounds.contains(b.bounds, { x, y }));

    if (clickedBody) {
      dragRef.current = { body: clickedBody, lastX: x, lastY: y };
      Matter.Body.setStatic(clickedBody, true);
      e.currentTarget.setPointerCapture(e.pointerId);
    } else {
      addFruit(x, y);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const d = dragRef.current;
    d.velX = (x - d.lastX);
    d.velY = (y - d.lastY);
    Matter.Body.setPosition(d.body, { x, y });
    d.lastX = x;
    d.lastY = y;
  };

  const handlePointerUp = () => {
    if (!dragRef.current) return;
    const d = dragRef.current;
    Matter.Body.setStatic(d.body, false);
    Matter.Body.setVelocity(d.body, {
      x: (d.velX || 0) * PARAMS.flingMultiplier * 10,
      y: (d.velY || 0) * PARAMS.flingMultiplier * 10,
    });
    dragRef.current = null;
  };

  return (
    <div className="fruit-physics-container">
      <div
        className="fruit-physics-canvas-wrap"
        ref={containerRef}
        onTouchStart={() => { if (!gyroEnabledRef.current) enableGyro(); }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: 'none' }}
      >
        <canvas ref={canvasRef} className="fruit-physics-canvas" />
      </div>
      <p className="fruit-count">
        {count} {citrus.label.toLowerCase()}{count !== 1 ? 's' : ''}
      </p>
      <p className="fruit-hint">Tap to add. Drag to move. Fling off edge to remove.</p>
      <button className="game-confirm" onClick={() => onConfirm(count)}>
        That's how many I have →
      </button>
    </div>
  );
}

export default FruitPhysics;
