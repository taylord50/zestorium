import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';

/**
 * LiquidBottle — Three.js 3D bottle with water shader.
 * The bottle is a transparent cylinder, the water is a displaced plane inside it.
 * Gyro rotates the bottle; gravity keeps water level with the real world.
 */

function LiquidBottle({ value, onChange }) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const bottleRef = useRef(null);
  const waterRef = useRef(null);
  const animRef = useRef(null);
  const tiltRef = useRef({ x: 0, z: 0 });
  const [dragging, setDragging] = useState(false);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const disturbanceRef = useRef(0); // 0 = calm, 1 = fully disturbed
  const lastDragY = useRef(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xFBF8F1);
    sceneRef.current = scene;

    // Camera - slight angle looking down
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 1.5, 5);
    camera.lookAt(0, 0.5, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);

    // Bottle (glass cylinder)
    const bottleGroup = new THREE.Group();
    scene.add(bottleGroup);
    bottleRef.current = bottleGroup;

    // Bottle body - tapered cylinder
    const bottleGeo = new THREE.CylinderGeometry(0.55, 0.6, 3, 32, 1, true);
    const bottleMat = new THREE.MeshPhysicalMaterial({
      color: 0x88ccaa,
      transparent: true,
      opacity: 0.35,
      roughness: 0.05,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const bottleMesh = new THREE.Mesh(bottleGeo, bottleMat);
    bottleMesh.position.y = 1.5;
    bottleGroup.add(bottleMesh);

    // Bottle wireframe edge for visibility
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x333333, wireframe: true, transparent: true, opacity: 0.1 });
    const edgeMesh = new THREE.Mesh(bottleGeo, edgeMat);
    edgeMesh.position.y = 1.5;
    bottleGroup.add(edgeMesh);

    // Bottle neck
    const neckGeo = new THREE.CylinderGeometry(0.2, 0.35, 0.8, 32, 1, true);
    const neckMesh = new THREE.Mesh(neckGeo, bottleMat);
    neckMesh.position.y = 3.4;
    bottleGroup.add(neckMesh);

    // Bottle bottom (cap)
    const bottomGeo = new THREE.CircleGeometry(0.6, 32);
    const bottomMat = new THREE.MeshPhysicalMaterial({
      color: 0xeeeeee,
      transparent: true,
      opacity: 0.3,
      roughness: 0.2,
    });
    const bottomMesh = new THREE.Mesh(bottomGeo, bottomMat);
    bottomMesh.rotation.x = -Math.PI / 2;
    bottomMesh.position.y = 0;
    bottleGroup.add(bottomMesh);

    // Cork
    const corkGeo = new THREE.CylinderGeometry(0.22, 0.2, 0.3, 16);
    const corkMat = new THREE.MeshLambertMaterial({ color: 0xC4A265 });
    const corkMesh = new THREE.Mesh(corkGeo, corkMat);
    corkMesh.position.y = 3.95;
    bottleGroup.add(corkMesh);

    // Water surface (displaced plane)
    const waterGeo = new THREE.CircleGeometry(0.54, 64);
    const waterMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uTilt: { value: new THREE.Vector2(0, 0) },
        uDisturbance: { value: 0 },
        uColor: { value: new THREE.Color(0x4499cc) },
        uOpacity: { value: 0.85 },
      },
      vertexShader: `
        uniform float uTime;
        uniform vec2 uTilt;
        uniform float uDisturbance;
        varying vec2 vUv;
        varying float vElevation;

        void main() {
          vUv = uv;
          vec3 pos = position;

          // Wave displacement scaled by disturbance (0 = flat, 1 = full waves)
          float wave1 = sin(pos.x * 6.0 + uTime * 2.0) * 0.02;
          float wave2 = sin(pos.y * 8.0 - uTime * 1.5) * 0.015;
          float wave3 = sin((pos.x + pos.y) * 10.0 + uTime * 3.0) * 0.008;
          float wave4 = sin(pos.x * 3.0 - uTime * 0.7) * 0.025;

          float waves = (wave1 + wave2 + wave3 + wave4) * uDisturbance;

          // Tilt offset (water tilts opposite to bottle tilt)
          float tiltOffset = pos.x * uTilt.x * 0.3 + pos.y * uTilt.y * 0.3;

          pos.z = waves + tiltOffset * uDisturbance;
          vElevation = pos.z;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vUv;
        varying float vElevation;

        void main() {
          // Lighter at wave peaks, darker in troughs
          vec3 color = uColor + vElevation * 2.0;
          // Edge darkening for depth feel
          float dist = length(vUv - 0.5) * 2.0;
          color *= 1.0 - dist * 0.3;

          gl_FragColor = vec4(color, uOpacity);
        }
      `,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.rotation.x = -Math.PI / 2;
    waterRef.current = waterMesh;
    bottleGroup.add(waterMesh);

    // Animation loop
    const clock = new THREE.Clock();
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const v = valueRef.current;

      // Position water at fill level (0 = bottom, 3 = top of body)
      waterMesh.position.y = v * 2.8 + 0.1;

      // Update water shader
      waterMat.uniforms.uTime.value = elapsed;
      waterMat.uniforms.uTilt.value.set(tiltRef.current.x, tiltRef.current.z);
      // Decay disturbance toward calm
      disturbanceRef.current *= 0.98;
      waterMat.uniforms.uDisturbance.value = disturbanceRef.current;

      // Bottle stays still

      renderer.render(scene, camera);
      animRef.current = requestAnimationFrame(animate);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  // Gyro handler - rotates the bottle
  const handleOrientation = useCallback((e) => {
    if (e.gamma === null || e.beta === null) return;
    const orientation = window.screen?.orientation?.angle || window.orientation || 0;
    let tiltX, tiltZ;
    if (orientation === 0) {
      tiltX = -(e.gamma / 90);
      tiltZ = (e.beta - 45) / 90; // subtract 45 because phone is held at angle
    } else {
      tiltX = -(e.gamma / 90);
      tiltZ = 0;
    }
    tiltX = Math.max(-1, Math.min(1, tiltX));
    tiltZ = Math.max(-1, Math.min(1, tiltZ));

    tiltRef.current = { x: tiltX, z: tiltZ };
    // Spike disturbance based on tilt magnitude
    disturbanceRef.current = Math.min(1, disturbanceRef.current + Math.abs(tiltX) * 0.05);

    // Keep bottle still, tilt the water instead
    if (waterRef.current) {
      waterRef.current.rotation.x = -Math.PI / 2 + tiltZ * 0.3;
      waterRef.current.rotation.y = tiltX * 0.3;
    }
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

  // Drag to change fill level
  const handlePointerDown = (e) => {
    setDragging(true);
    lastDragY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    const rect = mountRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const relY = y / rect.height;
    const newLevel = Math.max(0.05, Math.min(1, 1 - relY));
    // Spike disturbance on drag
    disturbanceRef.current = Math.min(1, disturbanceRef.current + 0.1);
    onChange(newLevel);
  };

  const handlePointerUp = () => {
    setDragging(false);
    lastDragY.current = null;
  };

  const mlAmount = Math.round((750 * value) / 25) * 25;

  return (
    <div className="liquid-bottle-container">
      <div
        className="liquid-bottle-3d"
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: 'none', cursor: 'ns-resize' }}
      />
      <p className="bottle-amount-text">~{mlAmount}ml</p>
      <p className="bottle-drag-hint">{dragging ? 'Release to set' : 'Drag up and down'}</p>
      {!gyroEnabled && (
        <button className="gyro-btn" onClick={enableGyro}>📱 Enable tilt</button>
      )}
    </div>
  );
}

export default LiquidBottle;
