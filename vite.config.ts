import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  // GitHub Pages serves a project site from a subfolder, but the dev server
  // and the LAN preview stay at the root — otherwise every local URL would
  // need the prefix typed in by hand.
  base: command === "build" ? "/dakaropoly/" : "/",
  // three-stdlib (pulled in by drei) and three's own example modules can each
  // resolve their own copy of three; two instances break the `instanceof`
  // checks React Three Fiber relies on.
  resolve: {
    dedupe: ["three", "react", "react-dom"],
  },
  // Bound to every interface so a phone on the same Wi-Fi can open the board.
  // `host` alone is not enough: the HMR client derives its websocket URL from
  // the page, so it must not be pinned to localhost either.
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4173,
  },
}));
