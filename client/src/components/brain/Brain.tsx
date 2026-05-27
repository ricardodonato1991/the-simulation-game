import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { generateBrain } from "./brainGeometry";
import type { BrainMode } from "../../lib/types";

interface BrainProps {
  activity: number; // 0..1
  mode: BrainMode;
}

const POINT_VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aRegion;
  uniform float uTime;
  uniform float uActivity;
  uniform float uSize;
  varying float vTw;
  varying float vRegion;
  void main() {
    vRegion = aRegion;
    float phase = aSeed * 6.2831 + uTime * (1.0 + uActivity * 2.2);
    float tw = 0.5 + 0.5 * sin(phase);
    // sparse bright "firing" synapses
    float fire = pow(0.5 + 0.5 * sin(aSeed * 53.0 + uTime * 3.4), 9.0);
    vTw = tw * 0.55 + fire * (0.4 + uActivity * 1.8) + 0.22;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float size = uSize * (0.55 + vTw * 0.95);
    gl_PointSize = size * (320.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const POINT_FRAG = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uActivity;
  varying float vTw;
  varying float vRegion;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.0, d);
    alpha *= alpha;
    float mixv = clamp(vTw * 0.45 * (0.4 + uActivity) + (vRegion == 1.0 ? 0.12 : 0.0), 0.0, 1.0);
    vec3 col = mix(uColorA, uColorB, mixv);
    if (vRegion == 2.0) col *= 0.7;        // brain stem dimmer
    if (vRegion == 1.0) col *= 0.92;        // cerebellum slightly deeper
    gl_FragColor = vec4(col * (0.55 + vTw * 1.1), alpha);
  }
`;

const SIGNAL_COUNT = 80;

export default function Brain({ activity, mode }: BrainProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  // Keep latest props available inside the animation loop without re-init.
  const propsRef = useRef<BrainProps>({ activity, mode });
  propsRef.current = { activity, mode };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0.05, 3.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    // --- build the brain point cloud ---
    const brain = generateBrain();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(brain.positions, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(brain.seeds, 1));
    geo.setAttribute("aRegion", new THREE.BufferAttribute(brain.regions, 1));

    const uniforms = {
      uTime: { value: 0 },
      uActivity: { value: activity },
      uSize: { value: 2.2 },
      uColorA: { value: new THREE.Color(0x0aff5a) },
      uColorB: { value: new THREE.Color(0xaaffdd) },
    };

    const pointMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: POINT_VERT,
      fragmentShader: POINT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, pointMat);
    const group = new THREE.Group();
    group.add(points);
    group.rotation.x = 0.12;
    scene.add(group);

    // --- neural signals travelling between surface anchors ---
    const sigPositions = new Float32Array(SIGNAL_COUNT * 3);
    const signals: { a: THREE.Vector3; b: THREE.Vector3; t: number; speed: number }[] = [];
    const anchorVec = (idx: number) =>
      new THREE.Vector3(
        brain.positions[idx * 3],
        brain.positions[idx * 3 + 1],
        brain.positions[idx * 3 + 2]
      );
    const randAnchor = () => brain.anchors[(Math.random() * brain.anchors.length) | 0];
    for (let i = 0; i < SIGNAL_COUNT; i++) {
      signals.push({ a: anchorVec(randAnchor()), b: anchorVec(randAnchor()), t: Math.random(), speed: 0.4 + Math.random() * 0.8 });
    }
    const sigGeo = new THREE.BufferGeometry();
    sigGeo.setAttribute("position", new THREE.BufferAttribute(sigPositions, 3));
    const sigMat = new THREE.PointsMaterial({
      color: 0xccffe6,
      size: 0.055,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const sigPoints = new THREE.Points(sigGeo, sigMat);
    group.add(sigPoints);

    // --- bloom post-processing for the glow ---
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // threshold > 0 keeps bloom on the bright synapse cores instead of washing
    // the whole brain out — sharper glow, and avoids a white-out on weak GPUs.
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.6, 0.22);
    composer.addPass(bloom);

    // --- sizing ---
    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      bloom.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // --- animation loop ---
    const clock = new THREE.Clock();
    let raf = 0;
    let smoothAct = activity;

    const tick = () => {
      const dt = clock.getDelta();
      const t = clock.elapsedTime;
      const { activity: targetAct } = propsRef.current;
      smoothAct += (targetAct - smoothAct) * Math.min(1, dt * 3);

      uniforms.uTime.value = t;
      uniforms.uActivity.value = smoothAct;
      bloom.strength = 0.55 + smoothAct * 0.9;

      // rotation accelerates with mental activity; gentle wobble always.
      group.rotation.y += dt * (0.18 + smoothAct * 0.5);
      group.rotation.x = 0.12 + Math.sin(t * 0.4) * 0.04;

      // advance signals
      const speedScale = 0.4 + smoothAct * 1.6;
      for (let i = 0; i < SIGNAL_COUNT; i++) {
        const s = signals[i];
        s.t += dt * s.speed * speedScale;
        if (s.t >= 1) {
          s.t = 0;
          s.a.copy(anchorVec(randAnchor()));
          s.b.copy(anchorVec(randAnchor()));
        }
        // ease along the path
        const e = s.t * s.t * (3 - 2 * s.t);
        sigPositions[i * 3] = s.a.x + (s.b.x - s.a.x) * e;
        sigPositions[i * 3 + 1] = s.a.y + (s.b.y - s.a.y) * e;
        sigPositions[i * 3 + 2] = s.a.z + (s.b.z - s.a.z) * e;
      }
      sigGeo.attributes.position.needsUpdate = true;
      sigMat.opacity = 0.45 + smoothAct * 0.5;

      // subtle breathing scale
      const breathe = 1 + Math.sin(t * 1.2) * 0.012 * (0.5 + smoothAct);
      group.scale.setScalar(breathe);

      composer.render();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      composer.dispose();
      geo.dispose();
      pointMat.dispose();
      sigGeo.dispose();
      sigMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={mountRef} style={{ position: "absolute", inset: 0 }} aria-label="Echo neural core" />;
}
