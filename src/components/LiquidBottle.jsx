import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * LiquidBottle — SVG bottle overlay + canvas liquid with wave physics.
 * The SVG defines the visual bottle. The canvas renders liquid clipped to the inner boundary.
 */

function LiquidBottle({ value, onChange }) {
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = (e) => {
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    const rect = containerRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const relY = y / rect.height;
    const newLevel = Math.max(0.05, Math.min(1, 1 - relY));
    onChange(newLevel);
  };

  const handlePointerUp = () => {
    setDragging(false);
  };

  const mlAmount = Math.round((750 * value) / 25) * 25;

  // Fill percentage mapped to the bottle body area (roughly 62-92% of SVG height)
  const fillTop = 92 - (value * 76); // percentage from top of SVG

  return (
    <div className="liquid-bottle-container">
      <div
        className="liquid-bottle-wrapper"
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: 'none', cursor: 'ns-resize', position: 'relative' }}
      >
        {/* Liquid fill (behind the SVG) */}
        <svg viewBox="0 0 200 500" className="bottle-liquid-svg">
          <defs>
            <clipPath id="bottle-interior-clip">
              <path d="
                M 88,72
                L 88,100
                C 88,110 75,130 62,155
                C 52,175 48,190 48,200
                L 48,430
                C 48,445 55,452 70,455
                L 130,455
                C 145,452 152,445 152,430
                L 152,200
                C 152,190 148,175 138,155
                C 125,130 112,110 112,100
                L 112,72
                Z
              "/>
            </clipPath>
          </defs>
          <rect
            x="0"
            y={`${fillTop}%`}
            width="200"
            height={`${100 - fillTop}%`}
            fill="rgba(255, 250, 230, 0.7)"
            clipPath="url(#bottle-interior-clip)"
          />
        </svg>

        {/* Bottle SVG overlay */}
        <img src="/bottle.svg" alt="" className="bottle-svg-overlay" />
      </div>
      <p className="bottle-amount-text">~{mlAmount}ml</p>
      <p className="bottle-drag-hint">{dragging ? 'Release to set' : 'Drag up and down'}</p>
    </div>
  );
}

export { };
export default LiquidBottle;
