"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * ScrollReveal — effet streaming au scroll, appliqué à tout le contenu.
 *
 * - Formes (fenêtres, cartes, titres) : fade-in + léger translate vers le haut.
 * - Texte : révélation caractère par caractère en cascade, façon terminal.
 *
 * Le contenu est rendu intégralement côté serveur (SEO, no-JS) puis
 * rejoué côté client à l'entrée dans le viewport, comme TypeWriter.
 *
 * mode="stream" découpe les nœuds texte du sous-arbre en spans `.sr-ch`
 * (une par caractère) après hydration. Ne l'utilisez qu'autour de contenu
 * statique rendu côté serveur : les composants interactifs qui se
 * re-rendent (formulaires, chat) doivent être enveloppés en mode="fade".
 * Sous-arbre à exclure de la découpe : attribut `data-no-stream`.
 */

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "TEMPLATE",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "OPTION",
  "BUTTON",
  "SVG",
  "IFRAME",
  "CANVAS",
  "AUDIO",
  "VIDEO",
  "NOSCRIPT",
]);

function splitTextNodes(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest("[data-no-stream]")) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (!/\S/.test(node.nodeValue ?? "")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: Text[] = [];
  for (let cur = walker.nextNode(); cur; cur = walker.nextNode()) {
    nodes.push(cur as Text);
  }

  let index = 0;
  for (const node of nodes) {
    const text = node.nodeValue ?? "";
    const fragment = document.createDocumentFragment();
    const word = /\S+/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = word.exec(text)) !== null) {
      if (match.index > last) {
        fragment.appendChild(document.createTextNode(text.slice(last, match.index)));
      }
      for (const char of match[0]) {
        const span = document.createElement("span");
        span.className = "sr-ch";
        span.style.setProperty("--sr-i", String(index++));
        span.textContent = char;
        fragment.appendChild(span);
      }
      last = match.index + match[0].length;
    }
    if (last < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(last)));
    }
    node.parentNode?.replaceChild(fragment, node);
  }
}

export function ScrollReveal({
  children,
  className,
  mode = "stream",
  delay = 0,
  style,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** "stream" : texte en cascade + fade. "fade" : fade seul (contenu interactif). */
  mode?: "stream" | "fade";
  /** Décalage initial de la révélation, en ms. */
  delay?: number;
  style?: CSSProperties;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "style">) {
  const ref = useRef<HTMLDivElement | null>(null);
  const armedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || armedRef.current) return;
    armedRef.current = true;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return; // pas d'effet : le contenu reste simplement visible
    }

    if (mode === "stream") splitTextNodes(el);
    el.style.setProperty("--sr-delay", `${delay}ms`);
    el.classList.add("sr-pending");

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        el.classList.add("sr-in");
        observer.disconnect();
      },
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // Armer une seule fois par montage : contenu statique, pas de re-jeu.
  }, [mode, delay]);

  return (
    <div ref={ref} data-sr={mode} className={cn("sr", className)} style={style} {...rest}>
      {children}
    </div>
  );
}
