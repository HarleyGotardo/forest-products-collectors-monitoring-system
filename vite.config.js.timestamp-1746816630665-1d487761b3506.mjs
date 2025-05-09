// vite.config.js
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "file:///C:/Users/Acer/OneDrive/Desktop/forest-products-collectors-monitoring-system/node_modules/vite/dist/node/index.js";
import vue from "file:///C:/Users/Acer/OneDrive/Desktop/forest-products-collectors-monitoring-system/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import vueDevTools from "file:///C:/Users/Acer/OneDrive/Desktop/forest-products-collectors-monitoring-system/node_modules/vite-plugin-vue-devtools/dist/vite.mjs";
import { NodeGlobalsPolyfillPlugin } from "file:///C:/Users/Acer/OneDrive/Desktop/forest-products-collectors-monitoring-system/node_modules/@esbuild-plugins/node-globals-polyfill/dist/index.js";
import { NodeModulesPolyfillPlugin } from "file:///C:/Users/Acer/OneDrive/Desktop/forest-products-collectors-monitoring-system/node_modules/@esbuild-plugins/node-modules-polyfill/dist/index.js";
var __vite_injected_original_import_meta_url = "file:///C:/Users/Acer/OneDrive/Desktop/forest-products-collectors-monitoring-system/vite.config.js";
var vite_config_default = defineConfig({
  plugins: [
    vue(),
    vueDevTools()
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url)),
      // This Rollup alias is used to make sure that the 'crypto' module is resolved to the browser-compatible version
      crypto: "crypto-browserify"
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: "globalThis"
      },
      // Enable esbuild polyfill plugins
      plugins: [
        NodeGlobalsPolyfillPlugin({
          buffer: true
        }),
        NodeModulesPolyfillPlugin()
      ]
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxBY2VyXFxcXE9uZURyaXZlXFxcXERlc2t0b3BcXFxcZm9yZXN0LXByb2R1Y3RzLWNvbGxlY3RvcnMtbW9uaXRvcmluZy1zeXN0ZW1cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXEFjZXJcXFxcT25lRHJpdmVcXFxcRGVza3RvcFxcXFxmb3Jlc3QtcHJvZHVjdHMtY29sbGVjdG9ycy1tb25pdG9yaW5nLXN5c3RlbVxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvQWNlci9PbmVEcml2ZS9EZXNrdG9wL2ZvcmVzdC1wcm9kdWN0cy1jb2xsZWN0b3JzLW1vbml0b3Jpbmctc3lzdGVtL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgVVJMIH0gZnJvbSAnbm9kZTp1cmwnXHJcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXHJcbmltcG9ydCB2dWUgZnJvbSAnQHZpdGVqcy9wbHVnaW4tdnVlJ1xyXG5pbXBvcnQgdnVlRGV2VG9vbHMgZnJvbSAndml0ZS1wbHVnaW4tdnVlLWRldnRvb2xzJ1xyXG5pbXBvcnQgeyBOb2RlR2xvYmFsc1BvbHlmaWxsUGx1Z2luIH0gZnJvbSAnQGVzYnVpbGQtcGx1Z2lucy9ub2RlLWdsb2JhbHMtcG9seWZpbGwnXHJcbmltcG9ydCB7IE5vZGVNb2R1bGVzUG9seWZpbGxQbHVnaW4gfSBmcm9tICdAZXNidWlsZC1wbHVnaW5zL25vZGUtbW9kdWxlcy1wb2x5ZmlsbCdcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgcGx1Z2luczogW1xyXG4gICAgdnVlKCksXHJcbiAgICB2dWVEZXZUb29scygpLFxyXG4gIF0sXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgJ0AnOiBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoJy4vc3JjJywgaW1wb3J0Lm1ldGEudXJsKSksXHJcbiAgICAgIC8vIFRoaXMgUm9sbHVwIGFsaWFzIGlzIHVzZWQgdG8gbWFrZSBzdXJlIHRoYXQgdGhlICdjcnlwdG8nIG1vZHVsZSBpcyByZXNvbHZlZCB0byB0aGUgYnJvd3Nlci1jb21wYXRpYmxlIHZlcnNpb25cclxuICAgICAgY3J5cHRvOiAnY3J5cHRvLWJyb3dzZXJpZnknXHJcbiAgICB9XHJcbiAgfSxcclxuICBvcHRpbWl6ZURlcHM6IHtcclxuICAgIGVzYnVpbGRPcHRpb25zOiB7XHJcbiAgICAgIC8vIE5vZGUuanMgZ2xvYmFsIHRvIGJyb3dzZXIgZ2xvYmFsVGhpc1xyXG4gICAgICBkZWZpbmU6IHtcclxuICAgICAgICBnbG9iYWw6ICdnbG9iYWxUaGlzJ1xyXG4gICAgICB9LFxyXG4gICAgICAvLyBFbmFibGUgZXNidWlsZCBwb2x5ZmlsbCBwbHVnaW5zXHJcbiAgICAgIHBsdWdpbnM6IFtcclxuICAgICAgICBOb2RlR2xvYmFsc1BvbHlmaWxsUGx1Z2luKHtcclxuICAgICAgICAgIGJ1ZmZlcjogdHJ1ZVxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIE5vZGVNb2R1bGVzUG9seWZpbGxQbHVnaW4oKVxyXG4gICAgICBdXHJcbiAgICB9XHJcbiAgfVxyXG59KSJdLAogICJtYXBwaW5ncyI6ICI7QUFBK1osU0FBUyxlQUFlLFdBQVc7QUFDbGMsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTyxTQUFTO0FBQ2hCLE9BQU8saUJBQWlCO0FBQ3hCLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsaUNBQWlDO0FBTCtOLElBQU0sMkNBQTJDO0FBUTFULElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLElBQUk7QUFBQSxJQUNKLFlBQVk7QUFBQSxFQUNkO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLGNBQWMsSUFBSSxJQUFJLFNBQVMsd0NBQWUsQ0FBQztBQUFBO0FBQUEsTUFFcEQsUUFBUTtBQUFBLElBQ1Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixnQkFBZ0I7QUFBQTtBQUFBLE1BRWQsUUFBUTtBQUFBLFFBQ04sUUFBUTtBQUFBLE1BQ1Y7QUFBQTtBQUFBLE1BRUEsU0FBUztBQUFBLFFBQ1AsMEJBQTBCO0FBQUEsVUFDeEIsUUFBUTtBQUFBLFFBQ1YsQ0FBQztBQUFBLFFBQ0QsMEJBQTBCO0FBQUEsTUFDNUI7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
