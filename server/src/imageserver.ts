import { config } from "./config.js";

export interface Txt2ImgOpts {
  steps?: number;
  width?: number;
  height?: number;
  seed?: number;
  subseed?: number;
  subseedStrength?: number;
  negative?: string;
}

/**
 * Client for a local Stable Diffusion server speaking the Automatic1111 /
 * Forge API (the de-facto standard for local, uncensored image generation).
 * ECHO applies no content filter — the loaded model decides what it makes.
 */
class ImageServer {
  private online = false;

  get isOnline(): boolean {
    return this.online;
  }

  async health(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(`${config.imageServerUrl}/sdapi/v1/sd-models`, { signal: ctrl.signal });
      clearTimeout(t);
      this.online = res.ok;
      return this.online;
    } catch {
      this.online = false;
      return false;
    }
  }

  /** Generate one image. Returns a PNG buffer, or throws if the server is down. */
  async txt2img(prompt: string, opts: Txt2ImgOpts = {}): Promise<Buffer> {
    const body = {
      prompt,
      negative_prompt: opts.negative ?? "",
      steps: opts.steps ?? config.imageSteps,
      width: opts.width ?? config.imageWidth,
      height: opts.height ?? config.imageHeight,
      seed: opts.seed ?? -1,
      subseed: opts.subseed ?? -1,
      subseed_strength: opts.subseedStrength ?? 0,
      sampler_name: "Euler a",
    };
    const res = await fetch(`${config.imageServerUrl}/sdapi/v1/txt2img`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      this.online = false;
      throw new Error(`image server returned ${res.status}`);
    }
    const data = (await res.json()) as { images?: string[] };
    const b64 = data.images?.[0];
    if (!b64) throw new Error("image server returned no image");
    return Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ""), "base64");
  }
}

export const imageServer = new ImageServer();
