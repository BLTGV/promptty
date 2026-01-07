// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://bltgv.github.io',
  base: '/promptty',
  integrations: [
    starlight({
      title: 'Promptty',
      logo: {
        src: './src/assets/logo.svg',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/BLTGV/promptty' },
      ],
      customCss: ['./src/styles/global.css'],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Installation', slug: 'installation' },
            { label: 'Configuration', slug: 'configuration' },
          ],
        },
        {
          label: 'Platform Setup',
          items: [
            { label: 'Slack Setup', slug: 'slack-setup' },
            { label: 'Teams Setup', slug: 'teams-setup' },
          ],
        },
        {
          label: 'Advanced',
          items: [
            { label: 'MCP Integration', slug: 'mcp-integration' },
            { label: 'Troubleshooting', slug: 'troubleshooting' },
          ],
        },
      ],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
