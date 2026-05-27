// Anatomical region anchors inside ECHO's brain point cloud. Ids match the
// server's emotion engine (server/src/emotions.ts). The brain coordinate frame:
// +x = right, +y = up, +z = front. Each region glows when ECHO's feelings or
// functions activate it, lighting that part of the brain like a real one.

export interface BrainRegion {
  id: string;
  pos: [number, number, number];
  radius: number; // influence falloff
}

export const BRAIN_REGIONS: BrainRegion[] = [
  { id: "prefrontal", pos: [0, 0.42, 0.88], radius: 0.55 }, // reasoning / focus
  { id: "limbic", pos: [0, -0.05, 0.05], radius: 0.42 }, // reward / joy / pride
  { id: "amygdala", pos: [0, -0.26, 0.22], radius: 0.26 }, // fear / frustration
  { id: "hippocampus", pos: [0, -0.16, -0.12], radius: 0.3 }, // memory / learning
  { id: "temporal_l", pos: [-0.82, -0.16, 0.05], radius: 0.42 }, // language / hearing
  { id: "temporal_r", pos: [0.82, -0.16, 0.05], radius: 0.42 },
  { id: "occipital", pos: [0, 0.05, -1.02], radius: 0.46 }, // vision
  { id: "motor", pos: [0, 0.66, 0.0], radius: 0.42 }, // action / movement
  { id: "cerebellum", pos: [0, -0.5, -0.92], radius: 0.46 }, // coordination
];

export const MAX_REGIONS = BRAIN_REGIONS.length;

export function regionIndex(id: string): number {
  return BRAIN_REGIONS.findIndex((r) => r.id === id);
}
