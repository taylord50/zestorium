import { useRef, useEffect, useState, useCallback } from 'react';

/**
 * LiquidBottle — A realistic interactive bottle with wave-based liquid simulation.
 * 
 * The bottle is rendered as an SVG shape. The liquid is rendered on a canvas
 * clipped to the bottle interior, with sine-wave surface animation that responds
 * to drag interactions.
 */

// Bottle shape constants (relative to a 200x400 viewport)
const BOTTLE_WIDTH = 160;
const BOTTLE_HEIGHT = 360;
const NECK_WIDTH = 40;
const NECK_HEIGHT = 60;
const SHOULDER_HEIGHT = 40;
const BODY_TOP = NECK_HEIGHT + SHOULDER_HEIGHT;
const BODY_HEIGHT = BOTTLE_HEIGHT - BODY_TOP;
const CAP_HEIGHT = 16;

// Wave simulation parameters
const NUM_POINTS = 40;
const DAMPING = 0.97;
const TENSION = 0.02;
const SPREAD = 0.25;

function LiquidBottle({ value, onChange }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animRef = useRef(null);
  const wavesRef = useRef({
    heights: new Array(NUM_POINTS).fill(0),
    velocities: new Array(NUM_POINTS).fill(0),
  });
  const lastDragY = useRef(null);
  const dragVelocity = useRef(0);
  const bubblesRef = useRef([]);
  const [dragging, setDragging] = useState(false);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [gyroAvailable, setGyroAvailable] = useState(false);

  // Check if gyro is available
  useEffect(() => {
    if (typeof DeviceOrientationEvent !== 'undefined') {
      setGyroAvailable(true);
    }
  }, []);

  // Scale factor for hi-dpi
  const scale = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const canvasW = 200;
  const canvasH = 420;

  // Disturb the wave surface
  const disturb = useCallback((amount) => {
    const waves = wavesRef.current;
    const mid = Math.floor(NUM_POINTS / 2);
    for (let i = 0; i < NUM_POINTS; i++) {
      const dist = Math.abs(i - mid) / (NUM_POINTS / 2);
      waves.velocities[i] += amount * (1 - dist * 0.7) * (Math.random() * 0.5 + 0.5);
    }
  }, []);

  // Gyroscope/accelerometer for phone sloshing
  const handleOrientation = useCallback((e) => {
    if (e.gamma === null || e.beta === null) return;

    // Compensate for screen orientation on iOS
    let tiltX;
    const orientation = window.screen?.orientation?.angle || window.orientation || 0;

    if (orientation === 0) {
      // Portrait: gamma is left/right
      tiltX = -(e.gamma / 90);
    } else if (orientation === 90 || orientation === -90) {
      // Landscape: beta becomes left/right
      tiltX = orientation === 90 ? (e.beta / 90) : -(e.beta / 90);
    } else {
      tiltX = -(e.gamma / 90);
    }

    // Clamp
    tiltX = Math.max(-1, Math.min(1, tiltX));

    const waves = wavesRef.current;
    for (let i = 0; i < NUM_POINTS; i++) {
      const pos = (i / (NUM_POINTS - 1)) - 0.5;
      waves.velocities[i] += tiltX * pos * 1.2;
    }
    for (let i = 0; i < NUM_POINTS; i++) {
      const pos = (i / (NUM_POINTS - 1)) - 0.5;
      const targetOffset = tiltX * pos * 30;
      const diff = targetOffset - waves.heights[i];
      waves.velocities[i] += diff * 0.02;
    }
  }, []);

  const enableGyro = async () => {
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
          setGyroEnabled(true);
        }
      } else {
        // Android — no permission needed
        window.addEventListener('deviceorientation', handleOrientation);
        setGyroEnabled(true);
      }
    } catch (e) {
      // Permission denied or not available
    }
  };

  // Cleanup gyro listener
  useEffect(() => {
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [handleOrientation]);

  // Bubble spawner
  useEffect(() => {
    const interval = setInterval(() => {
      if (value < 0.1) return;
      const bubbles = bubblesRef.current;
      if (bubbles.length < 8) {
        bubbles.push({
          x: 60 + Math.random() * 80, // within bottle body
          y: BODY_TOP + BODY_HEIGHT - 10,
          r: 1.5 + Math.random() * 2.5,
          speed: 0.3 + Math.random() * 0.6,
          drift: (Math.random() - 0.5) * 0.3,
          opacity: 0.4 + Math.random() * 0.3,
        });
      }
    }, 800);
    return () => clearInterval(interval);
  }, [value]);

  // Pointer interaction
  const handlePointerDown = (e) => {
    setDragging(true);
    lastDragY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    const rect = containerRef.current.getBoundingClientRect();

    // Map pointer position to fill level (entire canvas is the drag zone)
    const y = e.clientY - rect.top;
    const relY = y / rect.height;
    // Invert: top = full, bottom = empty. Use full canvas height.
    const newLevel = Math.max(0.05, Math.min(1, 1 - relY));

    // Calculate drag velocity for wave disturbance
    if (lastDragY.current !== null) {
      const dy = e.clientY - lastDragY.current;
      dragVelocity.current = dy * 0.3;
      disturb(dy * 0.12);
    }
    lastDragY.current = e.clientY;

    onChange(newLevel); // completely smooth, no snapping
  };

  const handlePointerUp = () => {
    setDragging(false);
    lastDragY.current = null;
    // Final splash on release
    disturb(dragVelocity.current * 2);
    dragVelocity.current = 0;
  };

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const animate = () => {
      const waves = wavesRef.current;
      const { heights, velocities } = waves;

      // Physics step: spring model
      const leftDeltas = new Array(NUM_POINTS).fill(0);
      const rightDeltas = new Array(NUM_POINTS).fill(0);

      // Update velocities based on spring tension
      for (let i = 0; i < NUM_POINTS; i++) {
        velocities[i] += -TENSION * heights[i];
        velocities[i] *= DAMPING;
        heights[i] += velocities[i];
      }

      // Propagate waves between neighbors
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < NUM_POINTS; i++) {
          if (i > 0) {
            leftDeltas[i] = SPREAD * (heights[i] - heights[i - 1]);
            velocities[i - 1] += leftDeltas[i];
          }
          if (i < NUM_POINTS - 1) {
            rightDeltas[i] = SPREAD * (heights[i] - heights[i + 1]);
            velocities[i + 1] += rightDeltas[i];
          }
        }
        for (let i = 0; i < NUM_POINTS; i++) {
          if (i > 0) heights[i - 1] += leftDeltas[i];
          if (i < NUM_POINTS - 1) heights[i + 1] += rightDeltas[i];
        }
      }

      // Render
      ctx.clearRect(0, 0, canvasW * scale, canvasH * scale);
      ctx.save();
      ctx.scale(scale, scale);

      // Draw bottle outline
      drawBottle(ctx);

      // Clip to bottle interior for liquid
      ctx.save();
      clipBottleInterior(ctx);
      drawLiquid(ctx, value, heights);
      drawBubbles(ctx, value, bubblesRef);
      ctx.restore();

      // Draw bottle glass overlay (reflections)
      drawGlassReflections(ctx);

      // Draw cap
      drawCap(ctx);

      ctx.restore();

      animRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [value, scale]);

  // Set canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvasW * scale;
    canvas.height = canvasH * scale;
    canvas.style.width = `${canvasW}px`;
    canvas.style.height = `${canvasH}px`;
  }, [scale]);

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
        style={{ touchAction: 'none', cursor: 'ns-resize', padding: '20px' }}
      >
        <canvas ref={canvasRef} className="liquid-bottle-canvas" />
      </div>
      <p className="bottle-amount-text">~{mlAmount}ml</p>
      <p className="bottle-drag-hint">{dragging ? 'Release to set' : 'Drag up and down'}</p>
      {gyroAvailable && !gyroEnabled && (
        <button className="gyro-btn" onClick={enableGyro}>
          📱 Enable tilt sloshing
        </button>
      )}
      {gyroEnabled && (
        <p className="gyro-active">✓ Tilt your phone to slosh</p>
      )}
    </div>
  );
}

// Drawing helpers

function drawBottle(ctx) {
  const x = (200 - BOTTLE_WIDTH) / 2;
  const neckX = (200 - NECK_WIDTH) / 2;

  ctx.beginPath();
  // Start at top-left of neck
  ctx.moveTo(neckX, CAP_HEIGHT);
  ctx.lineTo(neckX, NECK_HEIGHT);
  // Left shoulder curve
  ctx.bezierCurveTo(
    neckX, NECK_HEIGHT + SHOULDER_HEIGHT * 0.3,
    x, BODY_TOP - SHOULDER_HEIGHT * 0.3,
    x, BODY_TOP
  );
  // Left side of body
  ctx.lineTo(x, BODY_TOP + BODY_HEIGHT - 12);
  // Bottom-left radius
  ctx.quadraticCurveTo(x, BODY_TOP + BODY_HEIGHT, x + 12, BODY_TOP + BODY_HEIGHT);
  // Bottom
  ctx.lineTo(x + BOTTLE_WIDTH - 12, BODY_TOP + BODY_HEIGHT);
  // Bottom-right radius
  ctx.quadraticCurveTo(x + BOTTLE_WIDTH, BODY_TOP + BODY_HEIGHT, x + BOTTLE_WIDTH, BODY_TOP + BODY_HEIGHT - 12);
  // Right side of body
  ctx.lineTo(x + BOTTLE_WIDTH, BODY_TOP);
  // Right shoulder curve
  ctx.bezierCurveTo(
    x + BOTTLE_WIDTH, BODY_TOP - SHOULDER_HEIGHT * 0.3,
    neckX + NECK_WIDTH, NECK_HEIGHT + SHOULDER_HEIGHT * 0.3,
    neckX + NECK_WIDTH, NECK_HEIGHT
  );
  // Right side of neck
  ctx.lineTo(neckX + NECK_WIDTH, CAP_HEIGHT);

  ctx.strokeStyle = '#8B8177';
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function clipBottleInterior(ctx) {
  const x = (200 - BOTTLE_WIDTH) / 2 + 2;
  const w = BOTTLE_WIDTH - 4;
  const neckX = (200 - NECK_WIDTH) / 2 + 2;
  const neckW = NECK_WIDTH - 4;

  ctx.beginPath();
  ctx.moveTo(neckX, CAP_HEIGHT + 2);
  ctx.lineTo(neckX, NECK_HEIGHT);
  ctx.bezierCurveTo(
    neckX, NECK_HEIGHT + SHOULDER_HEIGHT * 0.3,
    x, BODY_TOP - SHOULDER_HEIGHT * 0.3,
    x, BODY_TOP
  );
  ctx.lineTo(x, BODY_TOP + BODY_HEIGHT - 12);
  ctx.quadraticCurveTo(x, BODY_TOP + BODY_HEIGHT - 2, x + 10, BODY_TOP + BODY_HEIGHT - 2);
  ctx.lineTo(x + w - 10, BODY_TOP + BODY_HEIGHT - 2);
  ctx.quadraticCurveTo(x + w, BODY_TOP + BODY_HEIGHT - 2, x + w, BODY_TOP + BODY_HEIGHT - 12);
  ctx.lineTo(x + w, BODY_TOP);
  ctx.bezierCurveTo(
    x + w, BODY_TOP - SHOULDER_HEIGHT * 0.3,
    neckX + neckW, NECK_HEIGHT + SHOULDER_HEIGHT * 0.3,
    neckX + neckW, NECK_HEIGHT
  );
  ctx.lineTo(neckX + neckW, CAP_HEIGHT + 2);
  ctx.closePath();
  ctx.clip();
}

function drawLiquid(ctx, fillLevel, waveHeights) {
  const bodyBottom = BODY_TOP + BODY_HEIGHT;
  const liquidHeight = (BODY_HEIGHT + NECK_HEIGHT) * fillLevel;
  const surfaceY = bodyBottom - liquidHeight;

  // Draw liquid body with wave surface
  ctx.beginPath();
  ctx.moveTo(0, bodyBottom);

  // Bottom edge
  ctx.lineTo(200, bodyBottom);
  ctx.lineTo(200, surfaceY);

  // Wave surface
  for (let i = NUM_POINTS - 1; i >= 0; i--) {
    const px = (i / (NUM_POINTS - 1)) * 200;
    const waveOffset = waveHeights[i];
    ctx.lineTo(px, surfaceY + waveOffset);
  }

  ctx.closePath();

  // Liquid gradient
  const gradient = ctx.createLinearGradient(0, surfaceY, 0, bodyBottom);
  gradient.addColorStop(0, 'rgba(255, 252, 240, 0.9)');   // Clear at top
  gradient.addColorStop(0.3, 'rgba(255, 248, 220, 0.85)'); // Slight warmth
  gradient.addColorStop(1, 'rgba(245, 240, 225, 0.8)');    // Slightly denser at bottom
  ctx.fillStyle = gradient;
  ctx.fill();

  // Surface highlight
  ctx.beginPath();
  for (let i = 0; i < NUM_POINTS; i++) {
    const px = (i / (NUM_POINTS - 1)) * 200;
    const waveOffset = waveHeights[i];
    if (i === 0) ctx.moveTo(px, surfaceY + waveOffset);
    else ctx.lineTo(px, surfaceY + waveOffset);
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawBubbles(ctx, fillLevel, bubblesRef) {
  const bodyBottom = BODY_TOP + BODY_HEIGHT;
  const liquidHeight = (BODY_HEIGHT + NECK_HEIGHT) * fillLevel;
  const surfaceY = bodyBottom - liquidHeight;

  const bubbles = bubblesRef.current;

  // Update and draw bubbles
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.y -= b.speed;
    b.x += b.drift + Math.sin(b.y * 0.05) * 0.3;

    // Remove if above surface
    if (b.y < surfaceY + 5) {
      bubbles.splice(i, 1);
      continue;
    }

    // Only draw if below surface (inside liquid)
    if (b.y > surfaceY) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${b.opacity})`;
      ctx.fill();
      // Tiny highlight
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${b.opacity * 0.8})`;
      ctx.fill();
    }
  }
}

function drawGlassReflections(ctx) {
  // Left highlight stripe
  const x = (200 - BOTTLE_WIDTH) / 2;

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + 15, BODY_TOP + 10, 8, BODY_HEIGHT - 30);
  ctx.restore();

  // Right subtle highlight
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + BOTTLE_WIDTH - 30, BODY_TOP + 20, 6, BODY_HEIGHT - 50);
  ctx.restore();
}

function drawCap(ctx) {
  const neckX = (200 - NECK_WIDTH) / 2;
  const capW = NECK_WIDTH + 6;
  const capX = (200 - capW) / 2;

  // Cap body
  ctx.fillStyle = '#DC3545';
  ctx.beginPath();
  ctx.roundRect(capX, 0, capW, CAP_HEIGHT, [3, 3, 0, 0]);
  ctx.fill();

  // Cap highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(capX + 4, 2, capW - 8, 4);

  // Cap ring at bottom
  ctx.fillStyle = '#B02A37';
  ctx.fillRect(capX, CAP_HEIGHT - 3, capW, 3);
}

export default LiquidBottle;
