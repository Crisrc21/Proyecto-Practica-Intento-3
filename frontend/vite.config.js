import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
    plugins: [react()],
    envDir: "..",
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url))
        }
    },
    server: {
        host: "0.0.0.0",
        port: 3000,
        proxy: {
            "/api": {
                target: "http://127.0.0.1:4000",
                changeOrigin: true
            }
        }
    }
});
