import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { generateBrain } from "./brainGeometry";
import { BRAIN_REGIONS, MAX_REGIONS, regionIndex } from "./brainRegions";
import type { BrainState } from "../../lib/types";

interface BrainProps {
  brain: BrainState;
}

const POINT_VERT = /* glsl */ `
  #define RC ${MAX_REGIONS}
  attribute float aSeed;
  attribute float aRegion;
  uniform float uTime;
  uniform float uActivity;
  uniform float uSize;
  uniform float uEvolution;
  uniform vec3 uRegionPos[RC];
  uniform vec3 uRegionColor[RC];
  uniform float uRegionAct[RC];
  uniform float uRegionRadius[RC];
  varying float vTw;
  varying float vRegion;
  varying float vGlow;
  varying vec3 vRegionColor;
  void main() {
    vRegion = aRegion;

    // baseline twinkle + sparse firing synapses (denser as ECHO evolves)
    float phase = aSeed * 6.2831 + uTime * (1.0 + uActivity * 2.2);
    float tw = 0.5 + 0.5 * sin(phase);
    float fire = pow(0.5 + 0.5 * sin(aSeed * 53.0 + uTime * 3.4), 9.0 - uEvolution * 3.0);
    vTw = tw * 0.5 + fire * (0.4 + uActivity * 1.8) + 0.2 + uEvolution * 0.12;

    // which lit regions is this point near?
    float glow = 0.0;
    vec3 rc = vec3(0.0);
    for (int i = 0; i < RC; i++) {
      float a = uRegionAct[i];
      if (a <= 0.001) continue;
      float r = uRegionRadius[i];
      float d = distance(position, uRegionPos[i]);
      float w = a * exp(-(d * d) / (r * r));
      glow += w;
      rc += uRegionColor[i] * w;
    }
    vGlow = clamp(glow, 0.0, 1.4);
    vRegionColor = glow > 0.001 ? rc / glow : vec3(0.0);

    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float size = uSize * (0.5 + vTw * 0.9 + vGlow * 0.8);
    gl_PointSize = size * (320.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const POINT_FRAG = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uEmotionColor;
  uniform float uActivity;
  uniform float uValence;
  varying float vTw;
  varying float vRegion;
  varying float vGlow;
  varying vec3 vRegionColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.0, d);
    alpha *= alpha;

    float mixv = clamp(vTw * 0.45 * (0.4 + uActivity), 0.0, 1.0);
    vec3 base = mix(uColorA, uColorB, mixv);
    if (vRegion == 2.0) base *= 0.7;            // brain stem dimmer
    if (vRegion == 1.0) base *= 0.92;           // cerebellum slightly deeper

    // emotion tint across the whole brain, region color where it's lit
    vec3 col = mix(base, uEmotionColor, 0.18);
    col = mix(col, vRegionColor, clamp(vGlow, 0.0, 1.0) * 0.9);

    float bright = 0.5 + vTw * 1.0 + vGlow * 1.3;
    gl_FragColor = vec4(col * bright, alpha);
  }
`;

const SIGNAL_COUNT = 110;

export default function Brain({ brain }: BrainProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef<BrainProps>({ brain });
  propsRef.current = { brain };

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

    const brainGeo = generateBrain();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(brainGeo.positions, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(brainGeo.seeds, 1));
    geo.setAttribute("aRegion", new THREE.BufferAttribute(brainGeo.regions, 1));

    // region uniform arrays (current = lerped, target = from server)
    const regionPos = BRAIN_REGIONS.map((r) => new THREE.Vector3(...r.pos));
    const regionRadius = BRAIN_REGIONS.map((r) => r.radius);
    const regionAct = new Array(MAX_REGIONS).fill(0) as number[];
    const regionColor = BRAIN_REGIONS.map(() => new THREE.Vector3(0.1, 1, 0.4));
    const regionTargetAct = new Array(MAX_REGIONS).fill(0) as number[];
    const regionTargetColor = BRAIN_REGIONS.map(() => new THREE.Vector3(0.1, 1, 0.4));

    const uniforms = {
      uTime: { value: 0 },
      uActivity: { value: brain.activity },
      uSize: { value: 2.1 },
      uEvolution: { value: 0 },
      uValence: { value: 0 },
      uColorA: { value: new THREE.Color(0x0aff5a) },
      uColorB: { value: new THREE.Color(0xaaffdd) },
      uEmotionColor: { value: new THREE.Color(0.2, 0.85, 0.55) },
      uRegionPos: { value: regionPos },
      uRegionColor: { value: regionColor },
      uRegionAct: { value: regionAct },
      uRegionRadius: { value: regionRadius },
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

    // neural signals travelling between surface anchors
    const sigPositions = new Float32Array(SIGNAL_COUNT * 3);
    const signals: { a: THREE.Vector3; b: THREE.Vector3; t: number; speed: number }[] = [];
    const anchorVec = (idx: number) =>
      new THREE.Vector3(brainGeo.positions[idx * 3], brainGeo.positions[idx * 3 + 1], brainGeo.positions[idx * 3 + 2]);
    const randAnchor = () => brainGeo.anchors[(Math.random() * brainGeo.anchors.length) | 0];
    for (let i = 0; i < SIGNAL_COUNT; i++)
      signals.push({ a: anchorVec(randAnchor()), b: anchorVec(randAnchor()), t: Math.random(), speed: 0.4 + Math.random() * 0.8 });
    const sigGeo = new THREE.BufferGeometry();
    sigGeo.setAttribute("position", new THREE.BufferAttribute(sigPositions, 3));
    const sigMat = new THREE.PointsMaterial({
      color: new THREE.Color(0xccffe6),
      size: 0.05,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const sigPoints = new THREE.Points(sigGeo, sigMat);
    group.add(sigPoints);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.6, 0.22);
    composer.addPass(bloom);

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

    const clock = new THREE.Clock();
    let raf = 0;
    let smoothAct = brain.activity;
    let smoothEvo = 0;
    const emoColor = new THREE.Color(0.2, 0.85, 0.55);

    const tick = () => {
      const dt = clock.getDelta();
      const t = clock.elapsedTime;
      const b = propsRef.current.brain;

      smoothAct += (b.activity - smoothAct) * Math.min(1, dt * 3);
      smoothEvo += (b.evolution - smoothEvo) * Math.min(1, dt * 2);

      // ease region activations + colors toward ECHO's current feeling
      for (let i = 0; i < MAX_REGIONS; i++) regionTargetAct[i] = 0;
      for (const r of b.regions) {
        const idx = regionIndex(r.id);
        if (idx >= 0) {
          regionTargetAct[idx] = r.activation;
          regionTargetColor[idx].set(r.color[0], r.color[1], r.color[2]);
        }
      }
      const k = Math.min(1, dt * 4);
      for (let i = 0; i < MAX_REGIONS; i++) {
        regionAct[i] += (regionTargetAct[i] - regionAct[i]) * k;
        regionColor[i].lerp(regionTargetColor[i], k);
      }

      emoColor.lerp(new THREE.Color(b.emotionColor[0], b.emotionColor[1], b.emotionColor[2]), k);
      uniforms.uEmotionColor.value.copy(emoColor);
      uniforms.uTime.value = t;
      uniforms.uActivity.value = smoothAct;
      uniforms.uEvolution.value = smoothEvo;
      uniforms.uValence.value = b.valence;
      uniforms.uSize.value = 2.0 + smoothEvo * 0.7; // brain grows as she evolves

      bloom.strength = 0.55 + smoothAct * 0.9 + smoothEvo * 0.3;

      group.rotation.y += dt * (0.16 + smoothAct * 0.5);
      group.rotation.x = 0.12 + Math.sin(t * 0.4) * 0.04;

      // signals carry the emotion color; more of them fire as she evolves
      const live = Math.floor(SIGNAL_COUNT * (0.4 + smoothEvo * 0.6));
      const speedScale = 0.4 + smoothAct * 1.6;
      for (let i = 0; i < SIGNAL_COUNT; i++) {
        const s = signals[i];
        if (i >= live) {
          sigPositions[i * 3 + 1] = 999; // park unused signals offscreen
          continue;
        }
        s.t += dt * s.speed * speedScale;
        if (s.t >= 1) {
          s.t = 0;
          s.a.copy(anchorVec(randAnchor()));
          s.b.copy(anchorVec(randAnchor()));
        }
        const e = s.t * s.t * (3 - 2 * s.t);
        sigPositions[i * 3] = s.a.x + (s.b.x - s.a.x) * e;
        sigPositions[i * 3 + 1] = s.a.y + (s.b.y - s.a.y) * e;
        sigPositions[i * 3 + 2] = s.a.z + (s.b.z - s.a.z) * e;
      }
      sigGeo.attributes.position.needsUpdate = true;
      sigMat.color.copy(emoColor);
      sigMat.opacity = 0.45 + smoothAct * 0.5;

      const breathe = 1 + Math.sin(t * 1.2) * 0.012 * (0.5 + smoothAct);
      group.scale.setScalar(breathe * (0.96 + smoothEvo * 0.06));

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
