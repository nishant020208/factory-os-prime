import { motion } from "framer-motion";
import { Factory } from "lucide-react";

/**
 * Compact loading indicator for route/tab transitions.
 * Shows a smaller shimmer bar + label inside the content area
 * so the sidebar/navbar stay visible and don't re-mount.
 *
 * Used as TanStack Router's pendingComponent on _authenticated routes.
 */
export function RouteLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[50vh] w-full">
      <div className="flex flex-col items-center gap-4">
        {/* Compact pulsing logo */}
        <motion.div
          className="h-12 w-12 rounded-xl bg-[image:var(--gradient-primary)] shadow-glow grid place-items-center"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Factory className="h-6 w-6 text-white" />
        </motion.div>

        {/* Label */}
        <motion.div
          className="text-sm text-muted-foreground"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        >
          {label}
        </motion.div>

        {/* Shimmer bar */}
        <div className="relative h-1 w-40 overflow-hidden rounded-full bg-white/5">
          <motion.div
            className="absolute inset-y-0 w-1/3 rounded-full bg-[image:var(--gradient-primary)]"
            animate={{ x: ["-100%", "300%"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <div className="text-[10px] text-muted-foreground/50">
          Switching modules...
        </div>
      </div>
    </div>
  );
}
