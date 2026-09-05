import { defineConfig, type UserConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

/**
 * The nitro vite plugin is optional: it is only added on build when the
 * package resolves. When it is skipped, the TanStack Start plugin alone
 * emits dist/client and dist/server, which is what the deployment uses.
 */
async function optionalNitroPlugin(): Promise<Plugin | null> {
  try {
    const { nitro } = await import("nitro/vite");
    return nitro({ defaultPreset: "cloudflare-module" });
  } catch {
    return null;
  }
}

export default defineConfig(async ({ command }) => {
  const config: UserConfig = {
    server: {
      host: "::",
      port: 8080,
    },
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        server: { entry: "server" },
        importProtection: {
          behavior: "error",
          client: {
            files: ["**/server/**"],
            specifiers: ["server-only"],
          },
        },
      }),
      ...(command === "build"
        ? ((await optionalNitroPlugin()) ?? [])
        : []),
      react(),
    ],
  };
  return config;
});
