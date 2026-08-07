import { useState, useRef, useEffect, useCallback } from 'react';
import { CITRUS_DATA } from '../config/citrusData';

/**
 * FruitPhysics — Tap to add fruits, drag to move, fling off screen to remove.
 * Gyro tilts gravity. Fruits collide with each other and screen edges.
 */

const CANVAS_W = 320;
const CANVAS_H = 480;
const GRAVITY = 0.3;
const BOUNCE = 0.5;
const FRICTION = 0.98;
const FLOOR_Y = CANVAS_H - 10;
const WALL_LEFT = 10;
const WALL_RIGHT = CANVAS_W - 10;

// Fruit dimensions (ellipse radii)
const FRUIT_SIZES = {
  lemon: { rx: 22, ry: 15, color: '#F5E06B' },
  lime: { rx: 14, ry: 13, color: '#7BC67E' },
  orange: { rx: 20, ry: 20, color: '#F5A623' },
  grapefruit: { rx: 26, ry: 25, color: '#F5908A' },
};

function FruitPhysics({ citrusType, onConfirm }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const fruitsRef = useRef([]);
  const animRef = useRef(null);
  const gravityRef = useRef({ x: 0, y: GRAVITY });
  const dragRef = useRef(null); // { index, offsetX, offsetY, lastX, lastY }
  const [count, setCount] = useState(0);
  const [gyroEnabled, setGyroEnabled] = useState(false);

  const fruitDef = FRUIT_SIZES[citrusType] || FRUIT_SIZES.lemon;
  const citrus = CITRUS_DATA[citrusType];

  // Add a fruit at position
  const addFruit = (x, y) => {
    const fruits = fruitsRef.current;
    fruits.push({
      x: x || CANVAS_W / 2 + (Math.random() - 0.5) * 60,
      y: y || 30,
      vx: (Math.random() - 0.5) * 2,
      vy: 0,
      rx: fruitDef.rx + (Math.random() - 0.5) * 3,
      ry: fruitDef.ry + (Math.random() - 0.5) * 2,
      rotation: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.05,
      squish: 1, // scale for squish animation
    });
    setCount(fruits.length);
  };

  // Physics step
  function simulate(fruits) {
    const g = gravityRef.current;
    const n = fruits.length;

    for (let i = n - 1; i >= 0; i--) {
      const f = fruits[i];

      // Skip if being dragged
      if (dragRef.current && dragRef.current.index === i) continue;

      // Gravity
      f.vx += g.x;
      f.vy += g.y;

      // Friction
      f.vx *= FRICTION;
      f.vy *= FRICTION;
      f.vr *= 0.98;

      // Move
      f.x += f.vx;
      f.y += f.vy;
      f.rotation += f.vr;

      // Squish recovery
      f.squish += (1 - f.squish) * 0.2;

      // Remove if off screen
      if (f.x < -60 || f.x > CANVAS_W + 60 || f.y < -100 || f.y > CANVAS_H + 60) {
        fruits.splice(i, 1);
        setCount(fruits.length);
        continue;
      }

      // Wall collisions
      if (f.x - f.rx < WALL_LEFT) {
        f.x = WALL_LEFT + f.rx;
        f.vx = Math.abs(f.vx) * BOUNCE;
        f.vr += f.vy * 0.01;
        f.squish = 0.85;
      }
      if (f.x + f.rx > WALL_RIGHT) {
        f.x = WALL_RIGHT - f.rx;
        f.vx = -Math.abs(f.vx) * BOUNCE;
        f.vr -= f.vy * 0.01;
        f.squish = 0.85;
      }
      if (f.y + f.ry > FLOOR_Y) {
        f.y = FLOOR_Y - f.ry;
        f.vy = -Math.abs(f.vy) * BOUNCE;
        f.vr += f.vx * 0.02;
        f.squish = 0.85;
        // Stop tiny bounces
        if (Math.abs(f.vy) < 0.5) f.vy = 0;
      }
    }

    // Fruit-fruit collision (circle approximation using average radius)
    for (let i = 0; i < fruits.length; i++) {
      for (let j = i + 1; j < fruits.length; j++) {
        const a = fruits[i];
        const b = fruits[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = (a.rx + a.ry) / 2 + (b.rx + b.ry) / 2;

        if (dist < minDist && dist > 0.001) {
          // Separate
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          // Skip if one is being dragged
          const aFixed = dragRef.current && dragRef.current.index === i;
          const bFixed = dragRef.current && dragRef.current.index === j;

          if (!aFixed && !bFixed) {
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;
          } else if (!aFixed) {
            a.x -= nx * overlap;
            a.y -= ny * overlap;
          } else if (!bFixed) {
            b.x += nx * overlap;
            b.y += ny * overlap;
          }

          // Bounce
          const dvx = b.vx - a.vx;
          const dvy = b.vy - a.vy;
          const relVel = dvx * nx + dvy * ny;
          if (relVel < 0) {
            const impulse = relVel * 0.5;
            if (!aFixed) { a.vx += nx * impulse; a.vy += ny * impulse; }
            if (!bFixed) { b.vx -= nx * impulse; b.vy -= ny * impulse; }
          }

          // Squish
          a.squish = 0.9;
          b.squish = 0.9;
        }
      }
    }
  }

  // Render
  function render(ctx, fruits) {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    for (const f of fruits) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);
      ctx.scale(f.squish, 2 - f.squish); // squish vertically when compressed

      // Draw ellipse
      ctx.beginPath();
      ctx.ellipse(0, 0, f.rx, f.ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = fruitDef.color;
      ctx.fill();
      ctx.strokeStyle = '#2A2A2A';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Small stem nub
      ctx.beginPath();
      ctx.moveTo(0, -f.ry);
      ctx.lineTo(-2, -f.ry - 6);
      ctx.lineTo(2, -f.ry - 5);
      ctx.strokeStyle = '#4A7A3A';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
    }
  }

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    const loop = () => {
      try {
        const fruits = fruitsRef.current;
        simulate(fruits);
        render(ctx, fruits);
      } catch (e) {
        console.error(e);
      }
      animRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [citrusType]);

  // Pointer: tap to add, drag to move, fling to remove
  const handlePointerDown = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Check if tapping on existing fruit
    const fruits = fruitsRef.current;
    for (let i = fruits.length - 1; i >= 0; i--) {
      const f = fruits[i];
      const dx = (x - f.x) / f.rx;
      const dy = (y - f.y) / f.ry;
      if (dx * dx + dy * dy < 1.5) {
        // Grabbed a fruit
        dragRef.current = { index: i, lastX: x, lastY: y, startTime: Date.now() };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    // Tap on empty space: add a fruit
    addFruit(x, y);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const d = dragRef.current;
    const f = fruitsRef.current[d.index];
    if (!f) { dragRef.current = null; return; }

    // Move fruit to pointer
    f.vx = (x - d.lastX) * 0.5;
    f.vy = (y - d.lastY) * 0.5;
    f.x = x;
    f.y = y;
    d.lastX = x;
    d.lastY = y;
  };

  const handlePointerUp = () => {
    if (dragRef.current) {
      // The fruit keeps its velocity from the drag (fling!)
      dragRef.current = null;
    }
  };

  // Gyro
  const handleOrientation = useCallback((e) => {
    if (e.gamma === null) return;
    let tiltX = -(e.gamma / 90);
    if (Math.abs(tiltX) < 0.06) tiltX = 0;
    tiltX = Math.max(-1, Math.min(1, tiltX));
    gravityRef.current = { x: tiltX * GRAVITY * 2, y: GRAVITY };
  }, []);

  const enableGyro = async () => {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
          setGyroEnabled(true);
        }
      } else {
        window.addEventListener('deviceorientation', handleOrientation);
        setGyroEnabled(true);
      }
    } catch (e) {}
  };

  useEffect(() => {
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [handleOrientation]);

  return (
    <div className="fruit-physics-container">
      <div
        className="fruit-physics-canvas-wrap"
        ref={containerRef}
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
      <p className="fruit-hint">Tap to add. Drag to move. Fling off screen to remove.</p>
      <button className="game-confirm" onClick={() => onConfirm(count)}>
        That's how many I have →
      </button>
      {!gyroEnabled && (
        <button className="gyro-btn" onClick={enableGyro}>📱 Enable tilt</button>
      )}
    </div>
  );
}

export default FruitPhysics;
