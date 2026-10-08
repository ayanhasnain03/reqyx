import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

function chromeExtensionHtml(): Plugin {
  return {
    name: "chrome-extension-html",
    transformIndexHtml(html) {
      return html.replace(/ crossorigin(="[^"]*")?/g, "");
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [chromeExtensionHtml()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    modulePreload: false,
    target: "chrome120",
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background.ts"),
        content: resolve(__dirname, "src/content.ts"),
        popup: resolve(__dirname, "popup.html"),
        panel: resolve(__dirname, "panel.html"),
        devtools: resolve(__dirname, "devtools.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "[name][extname]",
        format: "es",
      },
    },
  },
  publicDir: "public",
});
