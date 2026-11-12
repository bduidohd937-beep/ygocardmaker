import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins:[react()],
  base:'./',
  build:{
    outDir:'dist/embed',
    emptyOutDir:true,
    chunkSizeWarningLimit:1800,
    lib:{entry:'src/embed.tsx',formats:['es'],fileName:'cardmaker'},
    rollupOptions:{output:{inlineDynamicImports:true}},
  }
});
