import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    allowedHosts: ['localhost', 'apclient.stevebate.dev']
  },
  build: {
    rollupOptions: {
      onwarn(msg, handler) {
        // Ignore misplaced pure-annotation warnings
        if (msg.code === 'INVALID_ANNOTATION') return
        handler(msg)
      },
    },
  }
})
