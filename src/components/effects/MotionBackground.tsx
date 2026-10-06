"use client";

import { useEffect, useRef } from "react";

const GLYPHS = ["0", "1", "{", "}", "<", ">", "#", "$"];
const TAIL = 12; // glyphes par traînée
const LINE_H = 15;
const COL_W = 26;

/**
 * Pluie de glyphes façon matrice, en fond de tout le site.
 * - canvas fixed plein écran, z-0 sous le contenu (le wrapper de la
 *   page est en z-10), pointer-events-none, aria-hidden ;
 * - colonnes espacées, chute lente, vert phosphore très discret (~0.08) ;
 * - ~24 fps, pause quand l'onglet est caché, re-layout au resize ;
 * - aucun rendu sous prefers-reduced-motion.
 */
export function MotionBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    type Column = {
      x: number;
      y: number;
      speed: number; // px/s
      glyphs: string[];
    };
    let columns: Column[] = [];
    let vw = 0;
    let vh = 0;
    let raf = 0;
    let last = 0;

    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      vw = window.innerWidth;
      vh = window.innerHeight;
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Array.from({ length: Math.ceil(vw / COL_W) }, (_, i) => ({
        x: i * COL_W + 6,
        y: Math.random() * vh * 2 - vh,
        speed: 8 + Math.random() * 14,
        glyphs: Array.from(
          { length: TAIL },
          () => GLYPHS[(Math.random() * GLYPHS.length) | 0],
        ),
      }));
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (document.hidden) {
        last = now; // pas de saut au retour sur l'onglet
        return;
      }
      if (now - last < 1000 / 24) return; // ~24 fps
      const dt = Math.min(0.12, (now - last) / 1000);
      last = now;

      ctx.clearRect(0, 0, vw, vh);
      ctx.font = "12px monospace";
      for (const col of columns) {
        col.y += col.speed * dt;
        if (col.y - TAIL * LINE_H > vh) {
          col.y = -Math.random() * vh;
        }
        // mutation aléatoire d'un glyphe de la traînée
        if (Math.random() < 0.2) {
          col.glyphs[(Math.random() * col.glyphs.length) | 0] =
            GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        for (let i = 0; i < TAIL; i++) {
          const gy = col.y - i * LINE_H;
          if (gy < -LINE_H || gy > vh + LINE_H) continue;
          const alpha = i === 0 ? 0.16 : 0.08 * (1 - i / TAIL);
          ctx.fillStyle = `rgba(125, 255, 160, ${alpha.toFixed(3)})`;
          ctx.fillText(col.glyphs[i], col.x, gy);
        }
      }
    };

    layout();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", layout);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", layout);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
