import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * LiquidBottle — SPH fluid simulation inside bottle shape.
 * Uses Smoothed Particle Hydrodynamics with double density relaxation.
 * Rendered as smooth metaball surface on canvas.
 */

// Simulation params
const REST_DENSITY = 3.0;
const STIFFNESS = 0.2;
const STIFFNESS_NEAR = 0.4;
const INTERACTION_RADIUS = 18;
const VISCOSITY = 0.2;
const GRAVITY_Y = 0.2;
const DT = 1;
const PARTICLE_RADIUS = 5;
const VELOCITY_DAMPING = 0.97;
const PARTICLES_PER_ML = 0.85; // ~638 at 750ml, fills to mid-neck

// Canvas size (matches bottle.png aspect ratio 1024:1536 = 2:3)
const W = 280;
const H = 420;

// Bottle interior boundary traced from actual bottle.png pixels
// Fractions of image dimensions: [leftFrac, rightFrac, yFrac]
// Inset by glass thickness so liquid sits inside the glass walls
const GLASS_INSET = 0.008; // small inset - the thick artwork lines hide edge jitter
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

// Vertical range of the bottle interior (below neck opening, above base)
const IMG_TOP = 0.163;   // liquid can rise into the neck up to here
const IMG_BOTTOM = 0.89; // bottom of interior

function getBottleEdgesAtY(y) {
  const yFrac = y / H;
  // Clamp to profile range
  if (yFrac <= BOTTLE_PROFILE[0][2]) {
    const p = BOTTLE_PROFILE[0];
    return { left: (p[0] + GLASS_INSET) * W, right: (p[1] - GLASS_INSET) * W };
  }
  for (let i = 0; i < BOTTLE_PROFILE.length - 1; i++) {
    const curr = BOTTLE_PROFILE[i];
    const next = BOTTLE_PROFILE[i + 1];
    if (yFrac >= curr[2] && yFrac <= next[2]) {
      const t = (yFrac - curr[2]) / (next[2] - curr[2]);
      return {
        left: (curr[0] + (next[0] - curr[0]) * t + GLASS_INSET) * W,
        right: (curr[1] + (next[1] - curr[1]) * t - GLASS_INSET) * W,
      };
    }
  }
  const last = BOTTLE_PROFILE[BOTTLE_PROFILE.length - 1];
  return { left: (last[0] + GLASS_INSET) * W, right: (last[1] - GLASS_INSET) * W };
}

function createParticles(count, fillLevel) {
  const particles = [];
  const bodyTop = IMG_TOP * H;
  const bodyBottom = IMG_BOTTOM * H;
  const fillHeight = fillLevel * (bodyBottom - bodyTop);
  const startY = bodyBottom - fillHeight;

  for (let i = 0; i < count; i++) {
    const py = startY + Math.random() * fillHeight;
    const edges = getBottleEdgesAtY(py);
    particles.push({
      x: edges.left + Math.random() * (edges.right - edges.left),
      y: py,
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
    const target = Math.max(30, Math.round(750 * PARTICLES_PER_ML * value));
    particlesRef.current = createParticles(target, value);
  }, []);

  // Incrementally add/remove particles when value changes
  useEffect(() => {
    const particles = particlesRef.current;
    if (!particles) return;
    const target = Math.max(30, Math.round(750 * PARTICLES_PER_ML * value));

    if (particles.length < target) {
      // Add particles at the top of the current fluid
      const toAdd = target - particles.length;
      // Find current fluid surface (min y of existing particles, or bottom if empty)
      let surfaceY = IMG_BOTTOM * H;
      for (const p of particles) {
        if (p.y < surfaceY) surfaceY = p.y;
      }
      for (let i = 0; i < toAdd; i++) {
        const spawnY = Math.max(IMG_TOP * H, surfaceY - 10 - Math.random() * 20);
        const edges = getBottleEdgesAtY(spawnY);
        particles.push({
          x: edges.left + Math.random() * (edges.right - edges.left),
          y: spawnY,
          vx: 0,
          vy: 0,
          prevX: 0,
          prevY: 0,
        });
      }
      // Wake up so new particles settle
      sleepRef.current.sleeping = false;
      sleepRef.current.calmFrames = 0;
    } else if (particles.length > target) {
      // Remove particles from the top (highest = smallest y)
      const toRemove = particles.length - target;
      particles.sort((a, b) => a.y - b.y);
      particles.splice(0, toRemove);
      // Wake up briefly so the surface settles
      sleepRef.current.sleeping = false;
      sleepRef.current.calmFrames = 0;
    }
  }, [value]);

  // Sleep state: freeze simulation when settled
  const sleepRef = useRef({ sleeping: false, calmFrames: 0, lastGx: 0 });

  // SPH simulation step
  function simulate(particles, gx, gy) {
    const n = particles.length;
    const sleep = sleepRef.current;

    // Wake up if gravity changed (tilt) meaningfully
    if (Math.abs(gx - sleep.lastGx) > 0.05) {
      sleep.sleeping = false;
      sleep.calmFrames = 0;
    }
    sleep.lastGx = gx;

    // If sleeping, skip simulation entirely
    if (sleep.sleeping) return;

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

    // Build spatial hash grid (cell size = interaction radius)
    const cellSize = INTERACTION_RADIUS;
    const gridW = Math.ceil(W / cellSize);
    const gridH = Math.ceil(H / cellSize);
    const grid = new Array(gridW * gridH);
    for (let i = 0; i < n; i++) {
      const p = particles[i];
      const cx = Math.max(0, Math.min(gridW - 1, Math.floor(p.x / cellSize)));
      const cy = Math.max(0, Math.min(gridH - 1, Math.floor(p.y / cellSize)));
      const key = cy * gridW + cx;
      if (!grid[key]) grid[key] = [];
      grid[key].push(i);
    }

    // Get neighbor indices from surrounding cells
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

    // Double density relaxation (using spatial hash)
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
        pj.x += fx;
        pj.y += fy;
        pi.x -= fx;
        pi.y -= fy;
      }
    }

    // Viscosity (using spatial hash)
    for (let i = 0; i < n; i++) {
      const pi = particles[i];
      const neighbors = getNeighbors(pi);
      for (const j of neighbors) {
        if (j <= i) continue; // each pair once
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
          pi.vx -= ix * 0.5;
          pi.vy -= iy * 0.5;
          pj.vx += ix * 0.5;
          pj.vy += iy * 0.5;
        }
      }
    }

    // Boundary collision (no bounce - velocity dies at wall)
    // Inset by the render blob radius so the DRAWN liquid stays inside the bottle
    const RENDER_INSET = PARTICLE_RADIUS * 2 + 5; // render radius + blur spread
    const bottomY = IMG_BOTTOM * H - RENDER_INSET;
    const topY = IMG_TOP * H;
    // Rounded bottom: elliptical curve rising toward the sides
    const bodyLeft = 0.295 * W;
    const bodyRight = 0.692 * W;
    const centerX = (bodyLeft + bodyRight) / 2;
    const halfWidth = (bodyRight - bodyLeft) / 2;
    const bottomCurveHeight = 0.025 * H;

    for (let i = 0; i < n; i++) {
      const p = particles[i];
      // Rounded bottom: max y depends on horizontal distance from center
      const dx = Math.max(-1, Math.min(1, (p.x - centerX) / halfWidth));
      const curveDrop = (1 - Math.sqrt(1 - dx * dx)) * bottomCurveHeight;
      const localBottom = bottomY - curveDrop;
      if (p.y > localBottom) { p.y = localBottom; p.vy = 0; }
      if (p.y < topY) { p.y = topY; p.vy = 0; }
      // Left/right (bottle shape) inset by render radius
      const edges = getBottleEdgesAtY(p.y);
      if (p.x < edges.left + RENDER_INSET) { p.x = edges.left + RENDER_INSET; p.vx = 0; }
      if (p.x > edges.right - RENDER_INSET) { p.x = edges.right - RENDER_INSET; p.vx = 0; }
    }

    // Update velocities from position change, with global damping
    let totalEnergy = 0;
    for (let i = 0; i < n; i++) {
      const p = particles[i];
      p.vx = ((p.x - p.prevX) / DT) * VELOCITY_DAMPING;
      p.vy = ((p.y - p.prevY) / DT) * VELOCITY_DAMPING;
      // Kill tiny jitter velocities completely
      if (Math.abs(p.vx) < 0.02) p.vx = 0;
      if (Math.abs(p.vy) < 0.02) p.vy = 0;
      totalEnergy += p.vx * p.vx + p.vy * p.vy;
    }

    // Sleep detection: if average kinetic energy is very low for 30 frames, freeze
    const avgEnergy = n > 0 ? totalEnergy / n : 0;
    if (avgEnergy < 0.15) {
      sleep.calmFrames++;
      if (sleep.calmFrames > 30) {
        sleep.sleeping = true;
        // Zero all velocities for a clean freeze
        for (let i = 0; i < n; i++) {
          particles[i].vx = 0;
          particles[i].vy = 0;
        }
      }
    } else {
      sleep.calmFrames = 0;
    }
  }

  // Render: solid circles - the CSS "gooey" filter on the canvas element
  // merges them into a smooth liquid surface entirely on the GPU
  function render(ctx, particles) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(110, 180, 225, 0.9)';
    const r = PARTICLE_RADIUS * 2;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const loop = () => {
      try {
        const particles = particlesRef.current;
        if (particles && particles.length > 0) {
          const g = gravityRef.current;
          simulate(particles, g.x, g.y);
          render(ctx, particles);
        } else {
          ctx.clearRect(0, 0, W, H);
        }
      } catch (err) {
        // Never let an exception kill the animation loop
        console.error('Sim error:', err);
      }
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
    // Deadband: ignore tiny tilts (gyro sensor noise when phone is on a table)
    if (Math.abs(tiltX) < 0.06) tiltX = 0;
    // True gravity vector: rotate gravity by the tilt angle (negated - was inverted)
    const angle = -tiltX * (Math.PI / 4); // up to 45 degrees
    gravityRef.current = {
      x: Math.sin(angle) * GRAVITY_Y,
      y: Math.cos(angle) * GRAVITY_Y,
    };
  }, []);

  const gyroRequestedRef = useRef(false);
  const enableGyro = useCallback(async () => {
    if (gyroRequestedRef.current) return;
    gyroRequestedRef.current = true;
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
    } catch (e) {
      // Permission denied or failed — allow retry on next interaction
      gyroRequestedRef.current = false;
    }
  }, [handleOrientation]);

  // Try on mount (works if permission already granted)
  useEffect(() => {
    enableGyro();
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [handleOrientation]);

  // Drag — also triggers gyro permission on first touch (user gesture required by iOS)
  const handlePointerDown = (e) => {
    if (!gyroEnabled) enableGyro();
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
      // Just wake the sim - the add/remove of particles creates natural motion
      sleepRef.current.sleeping = false;
      sleepRef.current.calmFrames = 0;
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
        {/* SVG "gooey" filter definition - merges circles into smooth liquid on GPU */}
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <filter id="goo">
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
        {/* Liquid animation behind the bottle artwork */}
        <canvas ref={canvasRef} className="bottle-canvas" style={{ filter: 'url(#goo)' }} />
        {/* Bottle artwork on top */}
        <img src="/bottle.png" alt="Glass bottle" className="bottle-png-overlay" draggable={false} />
      </div>
      <p className="bottle-amount-text">~{mlAmount}ml</p>
      <p className="bottle-drag-hint">{dragging ? 'Release to set' : 'Drag up and down'}</p>
    </div>
  );
}

export default LiquidBottle;
