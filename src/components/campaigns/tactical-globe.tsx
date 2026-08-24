"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Globe } from "cobe";

const VIRGINIA_BEACH: [number, number] = [36.8529, -75.978];
const AFGHANISTAN: [number, number] = [34.5553, 69.2075];
const INITIAL_PHI = -1.51;
const INITIAL_THETA = 0.52;

export function TacticalGlobe({ campaignName }: { campaignName: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(INITIAL_PHI);
  const dragStartRef = useRef<number | null>(null);
  const dragOriginRef = useRef(INITIAL_PHI);
  const pointerIdRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;

    if (!stage || !canvas) {
      return;
    }

    let disposed = false;
    let globe: Globe | null = null;
    let animationFrame = 0;
    let previousFrame = performance.now();
    let isVisible = true;
    let cobeWrapper: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let intersectionObserver: IntersectionObserver | null = null;
    const originalParent = stage;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionPreference.matches;

    const handleMotionPreference = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
    };

    motionPreference.addEventListener("change", handleMotionPreference);

    const initialize = async () => {
      const { default: createGlobe } = await import("cobe");

      if (disposed) {
        return;
      }

      const readSize = () => {
        const bounds = stage.getBoundingClientRect();

        return {
          width: Math.max(1, Math.round(bounds.width)),
          height: Math.max(1, Math.round(bounds.height || bounds.width)),
        };
      };

      const size = readSize();
      globe = createGlobe(canvas, {
        width: size.width,
        height: size.height,
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        phi: phiRef.current,
        theta: INITIAL_THETA,
        dark: 1,
        diffuse: 2.3,
        scale: 0.91,
        mapSamples: 16000,
        mapBrightness: 2.4,
        mapBaseBrightness: 0.025,
        baseColor: [0.68, 0.7, 0.72],
        markerColor: [1, 0.32, 0.04],
        glowColor: [0.05, 0.09, 0.11],
        arcColor: [1, 0.32, 0.04],
        arcWidth: 0.55,
        arcHeight: 0.28,
        markerElevation: 0.035,
        markers: [
          {
            location: VIRGINIA_BEACH,
            size: 0.045,
            color: [0.35, 0.66, 1],
            id: "seal-origin",
          },
          {
            location: AFGHANISTAN,
            size: 0.055,
            color: [1, 0.28, 0.03],
            id: "mission-target",
          },
        ],
        arcs: [
          {
            from: VIRGINIA_BEACH,
            to: AFGHANISTAN,
            id: "deployment-route",
          },
        ],
      });

      cobeWrapper = canvas.parentElement === originalParent ? null : canvas.parentElement;

      resizeObserver = new ResizeObserver(() => {
        if (!globe) {
          return;
        }

        const nextSize = readSize();
        globe.update(nextSize);
      });
      resizeObserver.observe(stage);

      if ("IntersectionObserver" in window) {
        intersectionObserver = new IntersectionObserver(
          ([entry]) => {
            isVisible = entry?.isIntersecting ?? true;
          },
          { rootMargin: "180px" },
        );
        intersectionObserver.observe(stage);
      }

      const render = (now: number) => {
        if (disposed || !globe) {
          return;
        }

        const elapsed = Math.min(now - previousFrame, 40);
        previousFrame = now;

        if (isVisible && document.visibilityState !== "hidden") {
          if (!reducedMotion && !pausedRef.current && dragStartRef.current === null) {
            phiRef.current += elapsed * 0.00005;
          }

          const pulse = reducedMotion ? 0.5 : (Math.sin(now / 620) + 1) / 2;
          globe.update({
            phi: phiRef.current,
            theta: INITIAL_THETA,
            arcColor: [1, 0.18 + pulse * 0.22, 0.025],
          });
        }

        animationFrame = window.requestAnimationFrame(render);
      };

      animationFrame = window.requestAnimationFrame(render);
    };

    void initialize();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      motionPreference.removeEventListener("change", handleMotionPreference);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      globe?.destroy();

      if (cobeWrapper && canvas.parentElement === cobeWrapper) {
        originalParent.insertBefore(canvas, cobeWrapper);
        cobeWrapper.remove();
      }
    };
  }, []);

  const finishDrag = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStartRef.current = null;
    pointerIdRef.current = null;
    setDragging(false);
  };

  const handleKeyboard = (event: ReactKeyboardEvent<HTMLCanvasElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    phiRef.current += event.key === "ArrowLeft" ? -0.16 : 0.16;
  };

  return (
    <section className="deployment-tracker" aria-labelledby="deployment-title">
      <header className="deployment-tracker-heading">
        <div>
          <p className="campaign-kicker">Rastreamento global · transmissão 01</p>
          <h3 id="deployment-title">Vetor de {campaignName}</h3>
        </div>
        <span className="deployment-link-status">
          <i aria-hidden="true" /> Enlace seguro
        </span>
      </header>

      <div className="deployment-grid">
        <div className="tactical-globe-visual">
          <div className="tactical-globe-grid" aria-hidden="true" />
          <div ref={stageRef} className="tactical-globe-stage">
            <canvas
              ref={canvasRef}
              width={760}
              height={760}
              className="tactical-globe-canvas"
              data-dragging={dragging ? "true" : undefined}
              role="img"
              tabIndex={0}
              aria-label="Globo tático interativo com uma rota de Virginia Beach, nos Estados Unidos, até o Afeganistão. Arraste ou use as setas para girar."
              aria-describedby="deployment-route-summary"
              onFocus={() => {
                pausedRef.current = true;
              }}
              onBlur={() => {
                pausedRef.current = false;
              }}
              onPointerEnter={() => {
                pausedRef.current = true;
              }}
              onPointerLeave={() => {
                pausedRef.current = false;
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                pointerIdRef.current = event.pointerId;
                dragStartRef.current = event.clientX;
                dragOriginRef.current = phiRef.current;
                setDragging(true);
              }}
              onPointerMove={(event) => {
                if (
                  dragStartRef.current === null ||
                  pointerIdRef.current !== event.pointerId
                ) {
                  return;
                }

                phiRef.current =
                  dragOriginRef.current + (event.clientX - dragStartRef.current) / 180;
              }}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
              onKeyDown={handleKeyboard}
            >
              Globo tático: Estados Unidos para Afeganistão.
            </canvas>
          </div>
          <span className="globe-bearing globe-bearing-north" aria-hidden="true">
            N 36°
          </span>
          <span className="globe-bearing globe-bearing-east" aria-hidden="true">
            E 069°
          </span>
        </div>

        <div className="deployment-route-copy">
          <p id="deployment-route-summary" className="deployment-summary">
            O destacamento SEAL parte da costa leste dos Estados Unidos e cruza o
            Atlântico rumo ao teatro afegão, onde a Al-Qaeda prepara uma operação ainda
            desconhecida.
          </p>

          <ol className="deployment-route-list">
            <li className="route-origin">
              <span>01</span>
              <div>
                <p>Origem · USA</p>
                <h4>Virginia Beach</h4>
                <small>36.8529° N · 75.9780° W · mobilização SEAL</small>
              </div>
            </li>
            <li className="route-target">
              <span>02</span>
              <div>
                <p>Destino · AFG</p>
                <h4>Afeganistão</h4>
                <small>34.5553° N · 69.2075° E · área da missão</small>
              </div>
            </li>
          </ol>

          <div className="deployment-vector">
            <span>Vetor estimado</span>
            <strong>11.300 km</strong>
            <i aria-hidden="true">OESTE → LESTE</i>
          </div>

          <p className="globe-interaction-hint">
            <kbd>←</kbd><kbd>→</kbd> ou arraste para inspecionar a rota
          </p>
        </div>
      </div>
    </section>
  );
}
