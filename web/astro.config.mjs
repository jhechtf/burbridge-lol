import { defineConfig, envField } from 'astro/config';

import { loadEnv } from 'payload/node';
import tailwindcss from '@tailwindcss/vite';

loadEnv();

// https://astro.build/config
export default defineConfig({
  env: {
    schema: {
      NODE_ENV: envField.string({ context: 'server', access: 'secret' }),
    },
  },

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        $components: '/src/components',
        $layouts: '/src/layouts',
        $lib: '/src/lib',
        $types: '/src/types',
      },
    },
  },
});
