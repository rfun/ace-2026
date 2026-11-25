/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import heicConverterFile from './scripts/heic-converter-plugin.mjs';

export default defineConfig({
  plugins: [react(), viteSingleFile(), heicConverterFile()],
  build: { target: 'es2020', assetsInlineLimit: 100000000, cssCodeSplit: false },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
