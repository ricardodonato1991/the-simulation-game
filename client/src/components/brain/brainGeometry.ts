// Procedurally builds a human-brain-shaped point cloud — no external 3D asset
// required. Two folded cerebral hemispheres split by a longitudinal fissure,
// a cerebellum at the lower rear, and a brain stem. This is ECHO's brain.

export interface BrainGeometry {
  positions: Float32Array; // xyz per point
  seeds: Float32Array; // per-point random phase (0..1) for twinkle
  regions: Float32Array; // 0 cerebrum, 1 cerebellum, 2 stem
  count: number;
  anchors: number[]; // indices of surface points usable as signal endpoints
}

// --- compact 3D value noise (for the cortical folds) ----------------------

function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function fade(t: number): number {
  return t * t * (3 - 2 * t);
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function valueNoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = fade(xf), v = fade(yf), w = fade(zf);
  const c000 = hash3(xi, yi, zi), c100 = hash3(xi + 1, yi, zi);
  const c010 = hash3(xi, yi + 1, zi), c110 = hash3(xi + 1, yi + 1, zi);
  const c001 = hash3(xi, yi, zi + 1), c101 = hash3(xi + 1, yi, zi + 1);
  const c011 = hash3(xi, yi + 1, zi + 1), c111 = hash3(xi + 1, yi + 1, zi + 1);
  const x00 = lerp(c000, c100, u), x10 = lerp(c010, c110, u);
  const x01 = lerp(c001, c101, u), x11 = lerp(c011, c111, u);
  const y0 = lerp(x00, x10, v), y1 = lerp(x01, x11, v);
  return lerp(y0, y1, w);
}
function fbm(x: number, y: number, z: number, oct: number): number {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * valueNoise(x * freq, y * freq, z * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

// --- ridged fold field (gyri / sulci) -------------------------------------

function folds(x: number, y: number, z: number, freq: number): number {
  // Ridged noise reads as the rounded ridges and grooves of a cortex.
  const n = fbm(x * freq, y * freq, z * freq, 4);
  const ridge = 1 - Math.abs(n - 0.5) * 2; // peak at n=0.5
  return ridge;
}

function rand(): number {
  return Math.random();
}

// Cerebrum proportions: longest front-to-back (z), widest L-R (x), shortest top-bottom (y).
const W = 0.96; // half-width   (x)
const H = 0.82; // half-height  (y)
const L = 1.22; // half-length  (z)

export function generateBrain(): BrainGeometry {
  const cerebrum = 11000;
  const cerebellum = 2400;
  const stem = 900;
  const count = cerebrum + cerebellum + stem;

  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const regions = new Float32Array(count);
  const anchors: number[] = [];

  let p = 0;
  const put = (x: number, y: number, z: number, region: number) => {
    positions[p * 3] = x;
    positions[p * 3 + 1] = y;
    positions[p * 3 + 2] = z;
    seeds[p] = rand();
    regions[p] = region;
    if (region === 0 && p % 11 === 0) anchors.push(p);
    p++;
  };

  // ---- cerebrum: two folded hemispheres ----
  for (let i = 0; i < cerebrum; i++) {
    // uniform direction on the unit sphere
    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    let nx = s * Math.cos(phi);
    const ny = u;
    let nz = s * Math.sin(phi);

    const side = nx >= 0 ? 1 : -1;

    // cortical fold displacement along the radial direction
    const fold = folds(nx + 4, ny + 4, nz + 4, 3.4);
    const disp = 1 + (fold - 0.45) * 0.16;

    let x = nx * W * disp;
    let y = ny * H * disp;
    let z = nz * L * disp;

    // Longitudinal fissure: carve a groove down the top midline and nudge
    // each hemisphere outward so the two halves read separately.
    const midline = Math.exp(-(x * x) / 0.01);
    if (y > 0) y -= midline * 0.16 * Math.max(0, y);
    x += side * 0.05 * (0.4 + 0.6 * Math.max(0, y));

    // Frontal lobe a touch fuller, occipital tapered.
    if (z > 0.6) x *= 1.04;
    if (z < -0.7) {
      x *= 0.9;
      y *= 0.92;
    }

    // Flatten the underside where the brain sits on the skull base.
    if (y < -0.25) y = -0.25 + (y + 0.25) * 0.55;

    put(x, y, z, 0);
  }

  // ---- cerebellum: dense finely-folded blob, lower rear ----
  const cbCenter = { x: 0, y: -0.52, z: -0.92 };
  for (let i = 0; i < cerebellum; i++) {
    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const nx = s * Math.cos(phi);
    const ny = u;
    const nz = s * Math.sin(phi);
    const fold = folds(nx + 9, ny + 9, nz + 9, 9.0); // tighter folia
    const disp = 1 + (fold - 0.45) * 0.22;
    const x = cbCenter.x + nx * 0.42 * disp;
    const y = cbCenter.y + ny * 0.3 * disp;
    const z = cbCenter.z + nz * 0.42 * disp;
    put(x, y, z, 1);
  }

  // ---- brain stem: tapered column dropping down/forward ----
  for (let i = 0; i < stem; i++) {
    const t = rand(); // 0 top .. 1 bottom
    const radius = 0.16 * (1 - t * 0.55);
    const a = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand()) * radius;
    const x = Math.cos(a) * rr;
    const y = -0.45 - t * 0.62;
    const z = -0.55 + t * 0.16 + Math.sin(a) * rr;
    put(x, y, z, 2);
  }

  return { positions, seeds, regions, count, anchors };
}
