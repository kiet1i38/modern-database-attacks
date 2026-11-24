import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig(({ mode }) => {
  const presentation = mode === "presentation";
  return {
    root: fileURLToPath(new URL(presentation ? "./presentation/" : ".", import.meta.url)),
    publicDir: fileURLToPath(new URL("./public/", import.meta.url)),
    plugins: [react()],
    build: {
      outDir: fileURLToPath(new URL(presentation ? "../output/presentation/" : "../dist/", import.meta.url)),
      emptyOutDir: true
    },
    server: { host: "127.0.0.1", port: 5173, proxy: { "/api": "http://127.0.0.1:3004" } }
  };
});
