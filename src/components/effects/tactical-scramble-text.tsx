"use client";

import { useEffect, useState } from "react";

const TACTICAL_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/+?";

function scrambleFrame(text: string, progress: number, frame: number): string {
  const characters = [...text];
  const easedProgress = 1 - (1 - progress) ** 3;
  const revealedCharacters = Math.floor(easedProgress * characters.length);

  return characters
    .map((character, index) => {
      if (/\s/u.test(character) || index < revealedCharacters) {
        return character;
      }

      return TACTICAL_GLYPHS[(frame + index * 7) % TACTICAL_GLYPHS.length];
    })
    .join("");
}

export function TacticalScrambleText({
  text,
  as = "span",
  delay = 0,
}: {
  text: string;
  as?: "span" | "strong";
  delay?: number;
}) {
  const [renderedText, setRenderedText] = useState(text);
  const Tag = as;

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (motionPreference.matches) {
      return;
    }

    let animationFrame = 0;
    let frame = 0;
    const duration = 820;

    const timeout = window.setTimeout(() => {
      const startedAt = performance.now();

      const animate = (now: number) => {
        const progress = Math.min((now - startedAt) / duration, 1);
        setRenderedText(scrambleFrame(text, progress, frame));
        frame += 1;

        if (progress < 1) {
          animationFrame = window.requestAnimationFrame(animate);
        }
      };

      animationFrame = window.requestAnimationFrame(animate);
    }, delay);

    return () => {
      window.clearTimeout(timeout);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [delay, text]);

  return (
    <Tag aria-label={text}>
      <span className="tactical-scramble-visual" aria-hidden="true">
        {renderedText}
      </span>
    </Tag>
  );
}
