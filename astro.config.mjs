import { defineConfig, envField } from 'astro/config';
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  env: {
    schema: {
      NODE_ENV: envField.string({ context: 'server', access: 'secret' }),
    }
  }
});
