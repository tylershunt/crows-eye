import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const SERVER_PORT = process.env.CROWS_EYE_SERVER_PORT ?? "8787";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.CROWS_EYE_WEB_PORT ?? 5273),
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${SERVER_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
