# Promptty Website

The documentation and marketing website for Promptty, built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build).

## Development

```bash
# Install dependencies
bun install

# Start dev server at localhost:4321
bun dev

# Build for production
bun build

# Preview production build
bun preview
```

## Structure

```
website/
├── public/
│   └── favicon.svg
├── src/
│   ├── assets/
│   │   └── logo.svg
│   ├── content/
│   │   └── docs/
│   │       ├── index.mdx          # Landing page
│   │       ├── installation.mdx
│   │       ├── configuration.mdx
│   │       ├── slack-setup.mdx
│   │       ├── teams-setup.mdx
│   │       ├── mcp-integration.mdx
│   │       └── troubleshooting.mdx
│   └── styles/
│       └── global.css
├── astro.config.mjs
└── package.json
```

## Deployment

The website is automatically deployed to GitHub Pages when changes are pushed to `main`. See `.github/workflows/deploy-website.yml` for the workflow configuration.

**Live site:** https://bltgv.github.io/promptty/
