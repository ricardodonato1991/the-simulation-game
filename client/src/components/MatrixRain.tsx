import { useEffect, useRef } from "react";

// Subtle falling-glyph backdrop. Kept low-opacity via CSS so it never fights
// with the brain or the readouts.
export default function MatrixRain() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const glyphs = "01<>[]{}|/\\=+*アカサタナハマヤラ0123456789".split("");
    let cols = 0;
    let drops: number[] = [];
    const fontSize = 14;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cols = Math.floor(canvas.width / fontSize);
      drops = new Array(cols).fill(0).map(() => Math.random() * -50);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let lastDraw = 0;

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - lastDraw < 60) return; // ~16fps, easy on the CPU
      lastDraw = t;

      ctx.fillStyle = "rgba(1,4,1,0.2)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#14ff5e";
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const ch = glyphs[(Math.random() * glyphs.length) | 0];
        ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas id="matrix-rain" ref={ref} />;
}
