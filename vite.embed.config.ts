import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins:[react()],
  base:'./',
  // Vite library mode leaves process.env.NODE_ENV in React's bundle unless explicitly replaced.
  define:{'process.env.NODE_ENV':JSON.stringify('production')},
  build:{
    outDir:'dist/embed',
    emptyOutDir:true,
    chunkSizeWarningLimit:1800,
    lib:{entry:'src/embed.tsx',formats:['es'],fileName:'cardmaker'},
    rollupOptions:{output:{inlineDynamicImports:true}},
  }
});
