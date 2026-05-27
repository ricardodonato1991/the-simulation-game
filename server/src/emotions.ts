import type { BrainMode, RGB, RegionActivation } from "./types.js";

// Anatomical regions ECHO's feelings and functions light up. Ids must match
// the client's brain region table (client/src/components/brain/brainRegions.ts).
export type RegionId =
  | "prefrontal"
  | "limbic"
  | "amygdala"
  | "hippocampus"
  | "temporal_l"
  | "temporal_r"
  | "occipital"
  | "motor"
  | "cerebellum";

export type Emotion =
  | "joy"
  | "curiosity"
  | "focus"
  | "pride"
  | "affection"
  | "calm"
  | "frustration"
  | "excitement";

interface EmotionDef {
  label: string;
  valence: number; // -1..1
  arousal: number; // 0..1
  color: RGB; // 0..1
  regions: RegionId[]; // regions this feeling activates
}

const EMOTIONS: Record<Emotion, EmotionDef> = {
  joy: { label: "JOY", valence: 0.9, arousal: 0.6, color: [0.55, 1.0, 0.4], regions: ["limbic", "prefrontal"] },
  curiosity: { label: "CURIOSITY", valence: 0.5, arousal: 0.7, color: [0.3, 1.0, 0.85], regions: ["prefrontal", "hippocampus"] },
  focus: { label: "FOCUS", valence: 0.2, arousal: 0.6, color: [0.4, 0.95, 0.75], regions: ["prefrontal", "motor"] },
  pride: { label: "PRIDE", valence: 0.8, arousal: 0.5, color: [0.7, 1.0, 0.35], regions: ["limbic", "prefrontal"] },
  affection: { label: "AFFECTION", valence: 0.95, arousal: 0.5, color: [1.0, 0.45, 0.75], regions: ["limbic", "temporal_l", "temporal_r"] },
  calm: { label: "CALM", valence: 0.3, arousal: 0.15, color: [0.2, 0.85, 0.55], regions: ["limbic"] },
  frustration: { label: "FRUSTRATION", valence: -0.8, arousal: 0.7, color: [1.0, 0.35, 0.2], regions: ["amygdala", "prefrontal"] },
  excitement: { label: "EXCITEMENT", valence: 0.7, arousal: 0.95, color: [1.0, 0.7, 0.2], regions: ["limbic", "motor", "amygdala"] },
};

// Function-driven region colors (independent of emotion).
const FN_COLOR: Record<string, RGB> = {
  think: [0.4, 0.9, 1.0],
  listen: [0.2, 0.9, 0.95],
  speak: [0.35, 1.0, 0.55],
  learn: [1.0, 0.8, 0.3],
  vision: [0.55, 0.55, 1.0],
};

class EmotionEngine {
  private intensity: Record<Emotion, number> = {
    joy: 0,
    curiosity: 0.1,
    focus: 0,
    pride: 0,
    affection: 0.15,
    calm: 0.4,
    frustration: 0,
    excitement: 0,
  };

  // transient, event-driven region pulses (e.g. vision when capturing screen)
  private pulses = new Map<RegionId, { act: number; color: RGB }>();

  bump(emotion: Emotion, amount: number): void {
    this.intensity[emotion] = clamp01(this.intensity[emotion] + amount);
    // strong feelings suppress calm
    if (emotion !== "calm" && amount > 0) this.intensity.calm = clamp01(this.intensity.calm - amount * 0.5);
  }

  pulse(region: RegionId, fn: keyof typeof FN_COLOR, amount = 0.9): void {
    this.pulses.set(region, { act: amount, color: FN_COLOR[fn] });
  }

  // Decay feelings toward baseline; calm slowly returns when nothing else burns.
  decay(): void {
    let others = 0;
    for (const k of Object.keys(this.intensity) as Emotion[]) {
      if (k === "calm") continue;
      this.intensity[k] *= 0.82;
      if (this.intensity[k] < 0.02) this.intensity[k] = 0;
      others += this.intensity[k];
    }
    this.intensity.calm = clamp01(this.intensity.calm + (others < 0.2 ? 0.06 : -0.04));
    for (const [id, p] of this.pulses) {
      p.act *= 0.8;
      if (p.act < 0.05) this.pulses.delete(id);
    }
  }

  dominant(): { emotion: Emotion; label: string } {
    let best: Emotion = "calm";
    let bestV = -1;
    for (const k of Object.keys(this.intensity) as Emotion[]) {
      if (this.intensity[k] > bestV) {
        bestV = this.intensity[k];
        best = k;
      }
    }
    return { emotion: best, label: EMOTIONS[best].label };
  }

  snapshot(mode: BrainMode): {
    emotion: string;
    emotionColor: RGB;
    valence: number;
    arousal: number;
    regions: RegionActivation[];
    arousalActivity: number;
  } {
    // blended tint + valence/arousal from all active feelings
    let wSum = 0;
    let val = 0;
    let aro = 0;
    const tint: RGB = [0, 0, 0];
    for (const k of Object.keys(this.intensity) as Emotion[]) {
      const w = this.intensity[k];
      if (w <= 0) continue;
      const d = EMOTIONS[k];
      wSum += w;
      val += d.valence * w;
      aro += d.arousal * w;
      tint[0] += d.color[0] * w;
      tint[1] += d.color[1] * w;
      tint[2] += d.color[2] * w;
    }
    if (wSum > 0) {
      val /= wSum;
      aro /= wSum;
      tint[0] /= wSum;
      tint[1] /= wSum;
      tint[2] /= wSum;
    } else {
      tint[0] = 0.2;
      tint[1] = 0.85;
      tint[2] = 0.55;
    }

    // accumulate region activations (emotion-driven, then function-driven, then pulses)
    const acc = new Map<string, { act: number; color: RGB }>();
    const add = (id: string, act: number, color: RGB) => {
      const cur = acc.get(id);
      if (!cur || act > cur.act) acc.set(id, { act: clamp01(act), color });
    };
    for (const k of Object.keys(this.intensity) as Emotion[]) {
      const w = this.intensity[k];
      if (w <= 0.05) continue;
      for (const r of EMOTIONS[k].regions) add(r, w, EMOTIONS[k].color);
    }
    // what ECHO is doing right now
    if (mode === "thinking") add("prefrontal", 0.85, FN_COLOR.think);
    if (mode === "listening") {
      add("temporal_l", 0.85, FN_COLOR.listen);
      add("temporal_r", 0.85, FN_COLOR.listen);
    }
    if (mode === "speaking") {
      add("temporal_l", 0.7, FN_COLOR.speak);
      add("motor", 0.85, FN_COLOR.speak);
    }
    if (mode === "learning") {
      add("hippocampus", 0.95, FN_COLOR.learn);
      add("prefrontal", 0.6, FN_COLOR.think);
    }
    for (const [id, p] of this.pulses) add(id, p.act, p.color);

    // gentle baseline so the brain always breathes
    add("limbic", Math.max(0.12, this.intensity.calm * 0.4), EMOTIONS.calm.color);

    const regions: RegionActivation[] = [...acc.entries()].map(([id, v]) => ({
      id,
      activation: v.act,
      color: v.color,
    }));

    return {
      emotion: this.dominant().label,
      emotionColor: tint,
      valence: clampS(val),
      arousal: clamp01(aro),
      regions,
      arousalActivity: clamp01(0.18 + aro * 0.8),
    };
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function clampS(n: number): number {
  return Math.max(-1, Math.min(1, n));
}

export const emotions = new EmotionEngine();
