"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PortraitPrintProps {
  src: string;
  alt: string;
  className?: string;
}

type Phase = "idle" | "printing" | "done";

/**
 * Portrait « imprimé » par un terminal phosphore :
 * - l'<img> est rendue côté serveur (SEO, sans JS) ;
 * - au montage (sauf prefers-reduced-motion), un canvas recouvre l'image
 *   et la révèle ligne par ligne (~1,5 s) avec une scanline brillante en
 *   tête de balayage — pixels pré-filtrés en gris + teinte phosphore ;
 * - à la fin, le canvas s'efface en douceur et laisse place à la photo.
 */
export function PortraitPrint({ src, alt, className }: PortraitPrintProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    // prefers-reduced-motion : pas d'animation, l'image reste telle quelle.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let cancelled = false;

    const print = () => {
      if (cancelled) return;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const ctx = w && h ? canvas.getContext("2d") : null;
      if (!w || !h || !ctx) return; // image cassée : on garde l'<img> statique

      // Bitmap hors écran (taille plafonnée) : gris + teinte phosphore.
      const scale = Math.min(1, 640 / w);
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));
      const off = document.createElement("canvas");
      off.width = cw;
      off.height = ch;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return;
      octx.drawImage(img, 0, 0, cw, ch);
      const frame = octx.getImageData(0, 0, cw, ch);
      const px = frame.data;
      for (let i = 0; i < px.length; i += 4) {
        const lum = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
        px[i] = lum * 0.5;
        px[i + 1] = lum;
        px[i + 2] = lum * 0.55;
      }
      octx.putImageData(frame, 0, 0);

      canvas.width = cw;
      canvas.height = ch;
      setPhase("printing");

      const duration = 1500;
      const startedAt = performance.now();
      const draw = (now: number) => {
        if (cancelled) return;
        const t = Math.min(1, (now - startedAt) / duration);
        const revealed = Math.floor(ch * t);
        ctx.clearRect(0, 0, cw, ch);
        if (revealed > 0) {
          ctx.drawImage(off, 0, 0, cw, revealed, 0, 0, cw, revealed);
        }
        if (t < 1) {
          // scanline brillante en tête de balayage
          ctx.fillStyle = "rgba(198, 255, 214, 0.85)";
          ctx.fillRect(0, revealed, cw, 2);
          raf = requestAnimationFrame(draw);
        } else {
          setPhase("done");
        }
      };
      raf = requestAnimationFrame(draw);
    };

    if (img.complete && img.naturalWidth > 0) {
      raf = requestAnimationFrame(print);
    } else {
      img.addEventListener("load", print, { once: true });
    }
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      img.removeEventListener("load", print);
    };
  }, [src]);

  return (
    <div className={cn("relative", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- the canvas print effect draws this raw bitmap (naturalWidth/naturalHeight) line by line; a next/image wrapper would break it */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        width={800}
        height={1000}
        className={cn("block h-auto w-full", phase === "printing" && "invisible")}
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        className={cn(
          "absolute inset-0 h-full w-full transition-opacity duration-700",
          phase === "printing" ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
