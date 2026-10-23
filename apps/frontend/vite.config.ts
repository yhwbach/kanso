import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import oxlint from "vite-plugin-oxlint";
import { VitePWA } from "vite-plugin-pwa";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { BlockList, isIPv4 } from "node:net";
import { fileURLToPath, URL } from "node:url";

const BACKEND = process.env.KANSO_BACKEND_URL ?? "http://localhost:3000";
// localhost counts as a secure page, so plain http works on this machine only. Useful for browsers that refuse the self-signed certificate.
const PLAIN_HTTP = process.env.KANSO_HTTP === "1";

const HOME_NETWORK = new BlockList();
HOME_NETWORK.addSubnet("127.0.0.0", 8, "ipv4");
HOME_NETWORK.addSubnet("10.0.0.0", 8, "ipv4");
HOME_NETWORK.addSubnet("172.16.0.0", 12, "ipv4");
HOME_NETWORK.addSubnet("192.168.0.0", 16, "ipv4");
HOME_NETWORK.addSubnet("169.254.0.0", 16, "ipv4");
HOME_NETWORK.addAddress("::1", "ipv6");
HOME_NETWORK.addSubnet("fc00::", 7, "ipv6");
HOME_NETWORK.addSubnet("fe80::", 10, "ipv6");

/** The proxy reaches the backend from this machine, so the dev server applies the backend's home network rule itself. */
function homeNetworkOnly(): Plugin {
  return {
    name: "kanso-home-network-only",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const address = (req.socket.remoteAddress ?? "").replace(/^::ffff:(?=\d+\.)/, "").replace(/%.*$/, "");
        if (address && HOME_NETWORK.check(address, isIPv4(address) ? "ipv4" : "ipv6")) return next();
        res.statusCode = 403;
        res.end("Kanso can only be opened at home, on the same network as the computer running it.");
      });
    },
  };
}

export default defineConfig({
  plugins: [
    homeNetworkOnly(),
    // Browsers only allow the microphone and camera on secure pages, and the app is opened from other devices at home, so it is served over https.
    !PLAIN_HTTP && basicSsl({ name: "kanso" }),
    react(),
    tailwindcss(),
    oxlint({ path: ".", configFile: ".oxlintrc.json" }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["kanso.svg", "brand/*.svg"],
      manifest: {
        name: "Kanso",
        short_name: "Kanso",
        description: "Say it. It's done. Local, private voice control for your home.",
        theme_color: "#0b0b0b",
        background_color: "#f6f6f6",
        display: "standalone",
        start_url: "/app",
        scope: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/mcp/],
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.googleapis\.com\//, handler: "StaleWhileRevalidate", options: { cacheName: "google-fonts-stylesheets" } },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts-webfonts", expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    host: PLAIN_HTTP ? "localhost" : true,
    // The browser talks to one origin, so an https page never makes insecure calls to the backend.
    proxy: { "/api": { target: BACKEND, changeOrigin: false } },
  },
});
