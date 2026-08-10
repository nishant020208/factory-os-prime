import { motion } from "framer-motion";
import { Factory } from "lucide-react";

/**
 * Premium animated loading screen — orbiting particles + pulsing logo.
 * Used during auth hydration and heavy route transitions.
 */
export function LoadingScreen({ label = "Loading FactoryOS" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center aurora-bg">
      <div className="relative flex flex-col items-center gap-8">
        {/* Orbiting rings */}
        <div className="relative h-40 w-40">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border border-primary/30"
              style={{ borderWidth: 1 + i * 0.5 }}
              animate={{ rotate: 360, scale: [1, 1.05, 1] }}
              transition={{
                rotate: { duration: 6 + i * 2, repeat: Infinity, ease: "linear" },
                scale: { duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 },
              }}
            >
              <div
                className="absolute h-2 w-2 rounded-full bg-primary shadow-glow"
                style={{ top: -4, left: "50%", transform: "translateX(-50%)" }}
              />
            </motion.div>
          ))}

          {/* Pulsing core */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="h-16 w-16 rounded-2xl bg-[image:var(--gradient-primary)] shadow-glow grid place-items-center">
              <Factory className="h-7 w-7 text-white" />
            </div>
          </motion.div>

          {/* Ambient glow */}
          <motion.div
            className="absolute inset-0 rounded-full bg-primary/20 blur-3xl -z-10"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* Label + shimmer bar */}
        <div className="flex flex-col items-center gap-3">
          <motion.div
            className="text-sm font-medium tracking-wide text-foreground/80"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            {label}
          </motion.div>
          <div className="relative h-1 w-48 overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="absolute inset-y-0 w-1/3 rounded-full bg-[image:var(--gradient-primary)]"
              animate={{ x: ["-100%", "300%"] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
