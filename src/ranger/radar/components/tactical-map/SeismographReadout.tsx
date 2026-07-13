import { useEffect, useRef } from "preact/hooks";
import { Activity } from "lucide-preact";

const WIDTH = 220;
const HEIGHT = 64;
const DURATION_MS = 4200;

/**
 * A live-drawn scrolling waveform, canvas-based since this needs to redraw
 * every frame — framer-motion/CSS would fight the constant per-pixel
 * scrolling. Amplitude decays over `DURATION_MS` like a real seismic trace
 * settling after the initial jolt, scaled by the real BMKG magnitude when
 * available (purely cosmetic — see TODO.md, the drill itself is simulated).
 */
export function SeismographReadout({ magnitude }: { magnitude: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const baseAmplitude = Math.min(1, magnitude / 7) * (HEIGHT / 2 - 4);
    const start = performance.now();
    let raf: number;

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    function draw(now: number) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / DURATION_MS);
      // sharp jolt up front, long decaying tail — not a linear fade
      const decay = Math.max(0, 1 - progress) ** 1.6;

      const prev = ctx!.getImageData(2, 0, WIDTH - 2, HEIGHT);
      ctx!.fillStyle = "#0a0a0a";
      ctx!.fillRect(0, 0, WIDTH, HEIGHT);
      ctx!.putImageData(prev, 0, 0);

      const noise = (Math.sin(elapsed * 0.05) + Math.sin(elapsed * 0.13) * 0.6 + (Math.random() - 0.5)) / 2.1;
      const y = HEIGHT / 2 + noise * baseAmplitude * decay;

      ctx!.strokeStyle = "#3ddc59";
      ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      ctx!.moveTo(WIDTH - 3, HEIGHT / 2);
      ctx!.lineTo(WIDTH - 1, y);
      ctx!.stroke();

      if (progress < 1) raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [magnitude]);

  return (
    <div className="bg-[#131313] border border-[#444] px-3 py-2 flex flex-col gap-1.5 pointer-events-none">
      <div className="flex items-center gap-1.5">
        <Activity size={11} className="text-[#3ddc59]" />
        <span className="text-[#3ddc59] text-[10px] font-mono tracking-[1.5px] uppercase">
          Seismograf
        </span>
      </div>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="block" />
    </div>
  );
}
