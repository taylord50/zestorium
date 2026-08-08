import { useState, useRef, useEffect, useCallback } from 'react';
import Matter from 'matter-js';
import { CITRUS_DATA } from '../config/citrusData';

/**
 * FruitPhysicsDebug — Matter.js physics with fruit PNG rendering and tuning panel.
 */

const CANVAS_W = 320;
const CANVAS_H = 500;

// Fruit data: bounding boxes from traced PNGs, used for rendering crop
// Lemon and lime have traced polygon outlines for accurate collision
const FRUIT_DATA = {
  lemon: {
    img: '/fruit-lemon.png',
    bbox: { x: 161, y: 232, w: 712, h: 518 },
    rx: 356, ry: 259,
    polygon: [
      { x: -0.0312, y: -0.2715 }, { x: -0.1514, y: -0.2334 }, { x: -0.21, y: -0.1953 },
      { x: -0.2578, y: -0.1572 }, { x: -0.3057, y: -0.1191 }, { x: -0.335, y: -0.0811 },
      { x: -0.3408, y: -0.043 }, { x: -0.3281, y: -0.0049 }, { x: -0.3066, y: 0.0332 },
      { x: -0.2891, y: 0.0713 }, { x: -0.2637, y: 0.1094 }, { x: -0.2285, y: 0.1475 },
      { x: -0.1768, y: 0.1855 }, { x: -0.0713, y: 0.2236 }, { x: 0.0918, y: 0.2236 },
      { x: 0.1982, y: 0.1855 }, { x: 0.2529, y: 0.1475 }, { x: 0.2861, y: 0.1094 },
      { x: 0.3164, y: 0.0713 }, { x: 0.3486, y: 0.0332 }, { x: 0.3496, y: -0.0049 },
      { x: 0.3301, y: -0.043 }, { x: 0.3174, y: -0.0811 }, { x: 0.2979, y: -0.1191 },
      { x: 0.2695, y: -0.1572 }, { x: 0.2305, y: -0.1953 }, { x: 0.1729, y: -0.2334 },
      { x: 0.0498, y: -0.2715 },
    ],
  },
  lime: {
    img: '/fruit-lime.png',
    bbox: { x: 192, y: 231, w: 648, h: 508 },
    rx: 324, ry: 254,
    polygon: [
      { x: -0.0361, y: -0.2715 }, { x: -0.1465, y: -0.2334 }, { x: -0.1982, y: -0.1953 },
      { x: -0.2363, y: -0.1572 }, { x: -0.2666, y: -0.1191 }, { x: -0.2969, y: -0.0811 },
      { x: -0.3105, y: -0.043 }, { x: -0.3047, y: -0.0049 }, { x: -0.2783, y: 0.0332 },
      { x: -0.2627, y: 0.0713 }, { x: -0.2393, y: 0.1094 }, { x: -0.2031, y: 0.1475 },
      { x: -0.1445, y: 0.1855 }, { x: 0.1592, y: 0.1855 }, { x: 0.2217, y: 0.1475 },
      { x: 0.2529, y: 0.1094 }, { x: 0.2754, y: 0.0713 }, { x: 0.2891, y: 0.0332 },
      { x: 0.3164, y: -0.0049 }, { x: 0.3184, y: -0.043 }, { x: 0.2988, y: -0.0811 },
      { x: 0.2822, y: -0.1191 }, { x: 0.2568, y: -0.1572 }, { x: 0.2236, y: -0.1953 },
      { x: 0.1729, y: -0.2334 }, { x: 0.0566, y: -0.2715 },
    ],
  },
  orange: { img: '/fruit-orange.png', bbox: { x: 195, y: 201, w: 637, h: 576 }, rx: 318, ry: 288, polygon: null },
  grapefruit: { img: '/fruit-grapefruit.png', bbox: { x: 204, y: 203, w: 623, h: 575 }, rx: 312, ry: 288, polygon: null },
};

const DEFAULT_PARAMS = {
  fruitScale: 0.12,
  sizeVariation: 10,
  deformation: 15,
  gravity: 1.0,
  restitution: 0.6,
  friction: 0.2,
  frictionAir: 0.005,
  flingMultiplier: 0.05,
  density: 0.0076,
  angularDamping: 0.05,
  slop: 0.05,
  timeScale: 1.0,
};

// Per-fruit-type overrides for size/deformation defaults
const FRUIT_PARAM_DEFAULTS = {
  lemon: { sizeVariation: 10, deformation: 15 },
  lime: { sizeVariation: 10, deformation: 15 },
  orange: { sizeVariation: 10, deformation: 5 },
  grapefruit: { sizeVariation: 10, deformation: 5 },
};

function FruitPhysicsDebug({ activeCitrus: initialCitrus = 'lemon' }) {
  const [activeCitrus, setActiveCitrus] = useState(initialCitrus);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const renderLoopRef = useRef(null);
  const fruitsRef = useRef([]);  // array of { body, imgData }
  const paramsRef = useRef({ ...DEFAULT_PARAMS });
  const dragRef = useRef(null);
  const mouseConstraintRef = useRef(null);
  const [params, setParams] = useState({ ...DEFAULT_PARAMS });
  const [count, setCount] = useState(0);
  const fruitImgRef = useRef(null);

  paramsRef.current = params;
  const fruitDef = FRUIT_DATA[activeCitrus];
  const citrus = CITRUS_DATA[activeCitrus];

  // Load fruit image
  useEffect(() => {
    const img = new Image();
    img.src = fruitDef.img;
    img.onload = () => { fruitImgRef.current = img; };
  }, [activeCitrus]);

  // Initialize Matter.js engine
  useEffect(() => {
    const engine = Matter.Engine.create();
    engine.gravity.y = params.gravity;
    engineRef.current = engine;

    // Walls
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

    // No top wall — fruits can be flung off the top

    return () => {
      Matter.Engine.clear(engine);
      if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current);
    };
  }, []);

  // Update gravity when param changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.gravity.y = params.gravity;
    }
  }, [params.gravity]);

  // Add a fruit
  const addFruit = (x, y) => {
    const p = paramsRef.current;
    const engine = engineRef.current;
    if (!engine) return;

    const sizeRandom = 1 + ((Math.random() * 2 - 1) * (p.sizeVariation / 100));
    const deformRandom = 1 + ((Math.random() * 2 - 1) * (p.deformation / 100));
    const scaleRx = fruitDef.rx * p.fruitScale * sizeRandom * deformRandom;
    const scaleRy = fruitDef.ry * p.fruitScale * sizeRandom;

    // Ellipse polygon (20 vertices for smoother shape)
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
      restitution: p.restitution,
      friction: p.friction,
      frictionAir: p.frictionAir,
      density: p.density,
      slop: p.slop,
      render: { visible: false },
    });

    if (!body) return; // Matter.js can fail on degenerate shapes

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
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    const loop = () => {
      const engine = engineRef.current;
      if (!engine) { renderLoopRef.current = requestAnimationFrame(loop); return; }

      Matter.Engine.update(engine, (1000 / 60) * paramsRef.current.timeScale);
      cleanupFruits();

      // Render
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
          ctx.fillStyle = '#F5E06B';
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }

      renderLoopRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => { if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current); };
  }, [activeCitrus]);

  // Pointer handlers
  const handlePointerDown = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Check if clicking on existing fruit
    const engine = engineRef.current;
    if (!engine) return;

    const bodies = Matter.Composite.allBodies(engine.world);
    const clickedBody = bodies.find(b => !b.isStatic && Matter.Bounds.contains(b.bounds, { x, y }));

    if (clickedBody) {
      dragRef.current = { body: clickedBody, lastX: x, lastY: y };
      // Make it kinematic-ish by setting very low mass temporarily
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
    const p = paramsRef.current;
    Matter.Body.setStatic(d.body, false);
    Matter.Body.setVelocity(d.body, {
      x: (d.velX || 0) * p.flingMultiplier * 10,
      y: (d.velY || 0) * p.flingMultiplier * 10,
    });
    dragRef.current = null;
  };

  const updateParam = (key, val) => {
    const newParams = { ...params, [key]: parseFloat(val) };
    setParams(newParams);

    // Live-update existing bodies
    if (key === 'restitution' || key === 'friction' || key === 'frictionAir' || key === 'density' || key === 'slop') {
      for (const { body } of fruitsRef.current) {
        body.restitution = newParams.restitution;
        body.friction = newParams.friction;
        body.frictionAir = newParams.frictionAir;
        body.slop = newParams.slop;
      }
    }
  };

  const clearAll = () => {
    const engine = engineRef.current;
    if (!engine) return;
    for (const { body } of fruitsRef.current) {
      Matter.Composite.remove(engine.world, body);
    }
    fruitsRef.current = [];
    setCount(0);
  };

  const sliders = [
    { key: 'gravity', min: 0, max: 3, step: 0.1, label: 'Gravity' },
    { key: 'restitution', min: 0, max: 1, step: 0.05, label: 'Bounciness' },
    { key: 'friction', min: 0, max: 1, step: 0.05, label: 'Friction' },
    { key: 'frictionAir', min: 0, max: 0.1, step: 0.005, label: 'Air Resistance' },
    { key: 'density', min: 0.0001, max: 0.01, step: 0.0005, label: 'Density (weight)' },
    { key: 'angularDamping', min: 0, max: 1, step: 0.05, label: 'Spin Damping' },
    { key: 'slop', min: 0, max: 0.5, step: 0.01, label: 'Slop (softness)' },
    { key: 'timeScale', min: 0.2, max: 2, step: 0.1, label: 'Time Scale' },
    { key: 'fruitScale', min: 0.06, max: 0.25, step: 0.01, label: 'Fruit Scale' },
    { key: 'sizeVariation', min: 0, max: 100, step: 5, label: 'Size Variation (%)' },
    { key: 'deformation', min: 0, max: 100, step: 5, label: 'Deformation (%)' },
    { key: 'flingMultiplier', min: 0.01, max: 0.3, step: 0.01, label: 'Fling Speed' },
  ];

  return (
    <div style={{ display: 'flex', height: '100dvh', width: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FBF8F1' }}>
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ touchAction: 'none', border: '1px solid #ddd', borderRadius: 12 }}
        >
          <canvas ref={canvasRef} style={{ width: 280, height: 440 }} />
        </div>
        <p style={{ marginTop: 8, fontWeight: 700, color: '#2D5016' }}>{count} {citrus.label.toLowerCase()}{count !== 1 ? 's' : ''}</p>
        <p style={{ fontSize: 11, color: '#888' }}>Tap to add. Drag to move. Fling off edge to remove.</p>
      </div>

      <div style={{ width: 260, background: '#fff', borderLeft: '1px solid #ddd', padding: '12px', overflowY: 'auto', fontSize: 12 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Physics Tuning</h3>

        {/* Fruit selector */}
        <div style={{ marginBottom: 14 }}>
          <span style={{ fontWeight: 600 }}>Fruit Type:</span>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {Object.keys(FRUIT_DATA).map(key => (
              <button
                key={key}
                onClick={() => {
                  setActiveCitrus(key);
                  const overrides = FRUIT_PARAM_DEFAULTS[key] || {};
                  setParams(prev => ({ ...prev, ...overrides }));
                }}
                style={{
                  flex: 1, padding: '6px 2px', fontSize: 10, fontWeight: 600,
                  border: activeCitrus === key ? '2px solid #F5D547' : '1px solid #ddd',
                  borderRadius: 4, cursor: 'pointer',
                  background: activeCitrus === key ? '#FFF8DC' : '#fff',
                }}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        {sliders.map(({ key, min, max, step, label }) => (
          <div key={key} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>{label}</span>
              <span style={{ fontFamily: 'monospace' }}>{params[key]}</span>
            </div>
            <input
              type="range" min={min} max={max} step={step}
              value={params[key]}
              onChange={(e) => updateParam(key, e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        ))}
        <button
          onClick={clearAll}
          style={{ width: '100%', padding: 8, marginTop: 12, background: '#f44', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Clear All Fruit
        </button>
      </div>
    </div>
  );
}

export default FruitPhysicsDebug;
