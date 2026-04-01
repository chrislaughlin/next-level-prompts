import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    nitro(),
    tanstackStart(),
    viteReact(),
  ],
  build: {
    rollupOptions: {
      external: [
        'onnxruntime-node',
        'onnxruntime-common',
        '@huggingface/transformers',
        'sharp',
      ],
    },
  },
})

export default config
