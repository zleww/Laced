import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages serves the app from /Laced/, so the deploy workflow sets BASE_PATH.
  // Locally and on other hosts it stays at the site root.
  base: process.env.BASE_PATH || '/',
})
