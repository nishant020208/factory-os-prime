import { lazy, Suspense, useEffect, useState } from "react";
import factoryImg from "@/assets/furniture-factory.jpg";

const HalftoneReveal = lazy(() => import("./halftone-reveal"));

/**
 * Furniture-factory backdrop rendered as a halftone print that sharpens
 * around the cursor. Client-only (WebGL); skipped on small screens where
 * a static tinted image performs better.
 */
export function FactoryHalftoneBackdrop({ className = "" }: { className?: string }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setEnabled(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {enabled ? (
        <Suspense fallback={null}>
          <div className="absolute inset-0 opacity-[0.30] mix-blend-luminosity">
            <HalftoneReveal
              src={factoryImg}
              inkColor="#141414"
              paperColor="#0f172a"
              mode="mono"
              dotDensity={90}
              angle={28}
              revealRadius={0.28}
              contrast={1.25}
              idleReveal={0.12}
              trigger="hover"
              borderRadius="0px"
              style={{ pointerEvents: "auto", cursor: "default" }}
            />
          </div>
        </Suspense>
      ) : (
        <img
          src={factoryImg}
          alt="Custom furniture manufacturing workshop with teak planks and CNC wood router"
          className="absolute inset-0 h-full w-full object-cover opacity-[0.16]"
          loading="lazy"
          width={1600}
          height={1008}
        />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,var(--background)_0%,transparent_15%,transparent_85%,var(--background)_100%)]" />
      <div className="absolute inset-0 bg-background/45" />
    </div>
  );
}
