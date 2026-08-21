import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.CROWS_FOOT_WEB_PORT ?? 5273),
    // The app window is pointed at a fixed port, so moving is worse than failing.
    strictPort: true,
  },
});
