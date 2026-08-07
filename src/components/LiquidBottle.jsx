import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * LiquidBottle — SPH fluid simulation inside bottle shape.
 * Uses Smoothed Particle Hydrodynamics with double density relaxation.
 * Rendered as smooth metaball surface on canvas.
 */

// Simulation params
const NUM_PARTICLES = 120;
const REST_DENSITY = 3.0;
const STIFFNESS = 0.5;
const STIFFNESS_NEAR = 1.0;
const INTERACTION_RADIUS = 25;
const VISCOSITY = 0.02;
const GRAVITY_Y = 0.4;
const DT = 1;
const PARTICLE_RADIUS = 8;

// Canvas size
const W = 200;
const H = 420;

// Bottle interior boundary (simplified from SVG, in canvas coords)
// SVG was 1024x1536, canvas is 200x420
const SX = 200 / 1024;
const SY = 420 / 1536;

function getBottleEdgesAtY(y) {
  // Convert canvas y back to SVG space for boundary lookup
  const svgY = y / SY;
  // Neck (svgY 326-474): narrow
  if (svgY < 474) return { left: 454 * SX + 4, right: 570 * SX - 4 };
  // Shoulder (474-665): widens
  if (svgY < 665) {
    const t = (svgY - 474) / (665 - 474);
    const ease = t * t * (3 - 2 * t);
    return {
      left: (454 + (346 - 454) * ease) * SX + 4,
      right: (570 + (678 - 570) * ease) * SX - 4,
    };
  }
  // Body (665-1244): wide
  if (svgY < 1244) return { left: 346 * SX + 4, right: 678 * SX - 4 };
  // Base (1244-1380): narrows
  const t = Math.min(1, (svgY - 1244) / 120);
  return {
    left: (346 + t * 60) * SX + 4,
    right: (678 - t * 60) * SX - 4,
  };
}

function createParticles(count, fillLevel) {
  const particles = [];
  const bodyTop = 665 * SY;
  const bodyBottom = 1300 * SY;
  const fillHeight = fillLevel * (bodyBottom - bodyTop);
  const startY = bodyBottom - fillHeight;

  for (let i = 0; i < count; i++) {
    const edges = getBottleEdgesAtY(bodyBottom - (Math.random() * fillHeight));
    particles.push({
      x: edges.left + Math.random() * (edges.right - edges.left),
      y: startY + Math.random() * fillHeight,
      vx: 0,
      vy: 0,
      prevX: 0,
      prevY: 0,
    });
  }
  return particles;
}

function LiquidBottle({ value, onChange }) {
  const canvasRef = useRef(null);
  const metaCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const particlesRef = useRef(null);
  const gravityRef = useRef({ x: 0, y: GRAVITY_Y });
  const animRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const lastDragY = useRef(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Initialize particles
  useEffect(() => {
    particlesRef.current = createParticles(NUM_PARTICLES, value);
  }, []);

  // Recreate particles when value changes significantly
  const prevValue = useRef(value);
  useEffect(() => {
    if (Math.abs(value - prevValue.current) > 0.05) {
      prevValue.current = value;
      particlesRef.current = createParticles(NUM_PARTICLES, value);
    }
  }, [value]);

  // SPH simulation step
  function simulate(particles, gx, gy) {
    const n = particles.length;

    // Apply gravity and predict position
    for (let i = 0; i < n; i++) {
      const p = particles[i];
      p.prevX = p.x;
      p.prevY = p.y;
      p.vx += gx * DT;
      p.vy += gy * DT;
      p.x += p.vx * DT;
      p.y += p.vy * DT;
    }

    // Double density relaxation
    for (let i = 0; i < n; i++) {
      const pi = particles[i];
      let density = 0;
      let nearDensity = 0;

      // Find neighbors and compute density
      for (let j = 0; j < n; j++) {
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

      // Compute pressure
      const pressure = STIFFNESS * (density - REST_DENSITY);
      const nearPressure = STIFFNESS_NEAR * nearDensity;

      // Apply displacement
      for (let j = 0; j < n; j++) {
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
        pj.x += fx;
        pj.y += fy;
        pi.x -= fx;
        pi.y -= fy;
      }
    }

    // Viscosity
    for (let i = 0; i < n; i++) {
      const pi = particles[i];
      for (let j = i + 1; j < n; j++) {
        const pj = particles[j];
        const dx = pj.x - pi.x;
        const dy = pj.y - pi.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= INTERACTION_RADIUS) continue;

        const q = 1 - dist / INTERACTION_RADIUS;
        const dvx = pi.vx - pj.vx;
        const dvy = pi.vy - pj.vy;
        const u = (dvx * dx + dvy * dy) / dist;
        if (u > 0) {
          const impulse = VISCOSITY * q * u;
          const ix = (dx / dist) * impulse;
          const iy = (dy / dist) * impulse;
          pi.vx -= ix * 0.5;
          pi.vy -= iy * 0.5;
          pj.vx += ix * 0.5;
          pj.vy += iy * 0.5;
        }
      }
    }

    // Boundary collision
    const bottomY = 1300 * SY;
    const topY = 350 * SY;
    for (let i = 0; i < n; i++) {
      const p = particles[i];
      // Top/bottom
      if (p.y > bottomY) { p.y = bottomY; p.vy *= -0.3; }
      if (p.y < topY) { p.y = topY; p.vy *= -0.3; }
      // Left/right (bottle shape)
      const edges = getBottleEdgesAtY(p.y);
      if (p.x < edges.left) { p.x = edges.left; p.vx *= -0.3; }
      if (p.x > edges.right) { p.x = edges.right; p.vx *= -0.3; }
    }

    // Update velocities from position change
    for (let i = 0; i < n; i++) {
      const p = particles[i];
      p.vx = (p.x - p.prevX) / DT;
      p.vy = (p.y - p.prevY) / DT;
    }
  }

  // Render with metaball effect
  function render(ctx, particles) {
    const metaCanvas = metaCanvasRef.current;
    const metaCtx = metaCanvas.getContext('2d');

    // Clear
    ctx.clearRect(0, 0, W, H);
    metaCtx.clearRect(0, 0, W, H);

    // Draw particles as soft blobs on meta canvas
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const gradient = metaCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, PARTICLE_RADIUS);
      gradient.addColorStop(0, 'rgba(60, 140, 200, 0.8)');
      gradient.addColorStop(1, 'rgba(60, 140, 200, 0)');
      metaCtx.fillStyle = gradient;
      metaCtx.beginPath();
      metaCtx.arc(p.x, p.y, PARTICLE_RADIUS, 0, Math.PI * 2);
      metaCtx.fill();
    }

    // Threshold the metaball canvas to create smooth surface
    const imageData = metaCtx.getImageData(0, 0, W, H);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 80) {
        // Above threshold: render as water
        data[i] = 100;     // R
        data[i + 1] = 175; // G
        data[i + 2] = 220; // B
        data[i + 3] = 180; // A
      } else {
        // Below threshold: transparent
        data[i + 3] = 0;
      }
    }
    metaCtx.putImageData(imageData, 0, 0);

    // Draw the thresholded result onto main canvas
    ctx.drawImage(metaCanvas, 0, 0);
  }

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Create offscreen canvas for metaball
    const metaCanvas = document.createElement('canvas');
    metaCanvas.width = W;
    metaCanvas.height = H;
    metaCanvasRef.current = metaCanvas;

    const loop = () => {
      const particles = particlesRef.current;
      if (!particles) { animRef.current = requestAnimationFrame(loop); return; }

      const g = gravityRef.current;
      simulate(particles, g.x, g.y);
      render(ctx, particles);

      animRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
  }, []);

  // Gyro
  const handleOrientation = useCallback((e) => {
    if (e.gamma === null) return;
    const orientation = window.screen?.orientation?.angle || window.orientation || 0;
    let tiltX;
    if (orientation === 0) {
      tiltX = -(e.gamma / 90);
    } else {
      tiltX = -(e.gamma / 90);
    }
    tiltX = Math.max(-1, Math.min(1, tiltX));
    gravityRef.current = { x: tiltX * 0.6, y: GRAVITY_Y };
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

  // Drag
  const handlePointerDown = (e) => {
    setDragging(true);
    lastDragY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    const rect = containerRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const relY = y / rect.height;
    const newLevel = Math.max(0.05, Math.min(1, 1 - relY));

    if (lastDragY.current !== null) {
      const dy = e.clientY - lastDragY.current;
      // Shake particles
      gravityRef.current = { x: (Math.random() - 0.5) * 0.8, y: GRAVITY_Y + dy * 0.02 };
      setTimeout(() => { gravityRef.current = { x: 0, y: GRAVITY_Y }; }, 200);
    }
    lastDragY.current = e.clientY;
    onChange(newLevel);
  };

  const handlePointerUp = () => {
    setDragging(false);
    lastDragY.current = null;
    gravityRef.current = { x: 0, y: GRAVITY_Y };
  };

  const mlAmount = Math.round((750 * value) / 25) * 25;

  return (
    <div className="liquid-bottle-container">
      <div
        className="liquid-bottle-wrapper"
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: 'none', cursor: 'ns-resize' }}
      >
        <canvas ref={canvasRef} className="bottle-canvas" />
        <img src="/bottle.png" alt="Glass bottle" className="bottle-png-overlay" draggable={false} />
      </div>
      <p className="bottle-amount-text">~{mlAmount}ml</p>
      <p className="bottle-drag-hint">{dragging ? 'Release to set' : 'Drag up and down'}</p>
      {!gyroEnabled && (
        <button className="gyro-btn" onClick={enableGyro}>📱 Enable tilt</button>
      )}
    </div>
  );
}

export default LiquidBottle;
