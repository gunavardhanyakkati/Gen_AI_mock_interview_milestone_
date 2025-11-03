import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Hugging Face Space URL needs to be the target for the proxy
const HF_TARGET_URL = 'https://sritej15-mini-wav2vec2-asr.hf.space';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  optimizeDeps: {
    exclude: ['lucide-react'],
  },

  // 🛠️ Reverse Proxy Configuration
  server: {
    proxy: {
      // 1. Listen for requests starting with '/hf-proxy'
      '/hf-proxy': {
        // 🎯 Target the remote Hugging Face Space
        target: HF_TARGET_URL,
        
        // CRITICAL: Tells the browser the destination host is the target (fixes CORS)
        changeOrigin: true, 
        
        // ✂️ Remove the '/hf-proxy' prefix before forwarding the request to the target
        rewrite: (path) => path.replace(/^\/hf-proxy/, ''),
        
        // Ensures the secure connection works
        secure: true, 
      },
    },
    // Set host to '0.0.0.0' to make it accessible over the local network (optional but good for testing)
    host: '0.0.0.0' 
  },
});