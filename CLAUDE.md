# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Hexo static site generator project for a personal blog hosted on GitHub Pages (`AkiraZheng.github.io`). The site uses the **archer** theme with custom configuration. Content is written in Markdown and stored in `source/_posts/`. The site includes features like search (Algolia), post encryption, comment systems, and analytics.

## Common Commands

All commands are run via npm scripts defined in `package.json`:

- `npm run clean` – Remove generated files and caches (`hexo clean`)
- `npm run build` – Generate static site to `public/` (`hexo generate`)
- `npm run server` – Start local development server (default at `http://localhost:4000`)
- `npm run deploy` – Build and deploy to GitHub Pages (`hexo deploy`)

**Development workflow:**
1. Write new posts in `source/_posts/` as `.md` files with front‑matter.
2. Run `npm run server` to preview locally.
3. Run `npm run deploy` to publish changes (automatically builds and pushes to the `main` branch).

## Architecture

### Repository Structure
- **Source branch:** `dev` – contains all source files (Markdown posts, configs, themes).
- **Deployment branch:** `main` – contains the generated static site (`public/`). The `hexo-deployer-git` plugin pushes to this branch automatically when running `npm run deploy`.

### Configuration Files
- `_config.yml` – **Root Hexo configuration**. Contains site metadata, deployment settings (including a GitHub token), plugin options, and Algolia keys. **This file is listed in `.gitignore` but may still be present in the repository; treat its credentials as sensitive.**
- `_config.archer.yml` – Theme‑specific configuration for the archer theme (profile, appearance, search, comments, analytics). Most visual customizations belong here, not in the theme’s own files.
- `themes/archer/` – The archer theme files. Avoid modifying these directly; override settings via `_config.archer.yml` or use theme inheritance if needed.

### Content Structure
- `source/_posts/` – All blog posts in Markdown. Posts can have asset folders (enabled by `post_asset_folder: true`).
- `source/about/`, `source/categories/` – Static pages.
- `scaffolds/` – Templates for new posts, pages, and drafts.

### Build Output
- `public/` – Generated static site (ignored by Git). Created by `npm run build`.
- `db.json` – Cache file (ignored).

### Plugins & Features
The site uses several Hexo plugins (see `package.json`):
- `hexo-algolia` – Search index (configured in `_config.yml` `algolia` section).
- `hexo-blog-encrypt` – Password protection for specific posts (see `encrypt` section).
- `hexo-generator-json-content` – Creates `content.json` for client‑side search.
- `hexo-asset-image` – Resolves image paths in posts.
- `hexo-deployer-git` – Deploys to GitHub Pages.

### Theme Development
The `themes/archer/` directory contains its own build system (Gulp, Webpack). If you need to modify the theme's assets or styles:
1. Run `npm run dev` inside the theme folder to start a live‑reload development server.
2. Run `npm run build` to compile production assets.
3. The main site’s `npm run server` uses the pre‑built theme assets; theme changes are not reflected automatically unless you rebuild the theme.

## Important Notes

### Security & Credentials
- The `_config.yml` contains a GitHub token (`ghp_...`) and Algolia API keys. Although `.gitignore` lists `_config.yml`, the file is currently committed. **Never commit changes that expose valid credentials.** Rotate tokens if they have been exposed.
- The repository’s README mentions that `_config.yml` “contains github token information cannot git upload.” Ensure any changes to this file are made cautiously.

### Deployment
- Deployment is configured to push the generated `public/` contents to the `main` branch of `https://github.com/AkiraZheng/AkiraZheng.github.io` (the GitHub Pages branch).
- The `deploy` script runs `hexo deploy`, which uses the `hexo-deployer-git` plugin.

### Theme Customization
- All theme‑related settings (avatar, social links, search, comments, analytics) are controlled by `_config.archer.yml`.
- To modify layouts or styles, consider creating a separate theme folder or overriding templates via Hexo’s theme inheritance (see [Hexo documentation](https://hexo.io/docs/themes#Overriding-Theme-Files)).
- The `archer` theme supports multiple comment providers (Livere, Disqus, Valine, etc.), Algolia search, and Baidu/Google analytics.

### Search
- Algolia search is enabled. The index is updated when running `hexo algolia` (not part of the default npm scripts; you may need to run `npx hexo algolia` manually after adding new posts).
- Configuration is in `_config.yml` under the `algolia` block.

### Post Encryption
- Posts can be encrypted by adding a `password` field in the front‑matter or using the `encrypt.tags` mapping in `_config.yml`. See [hexo-blog-encrypt](https://github.com/MikeCoder/hexo-blog-encrypt) for details.

## Development Tips

- **Local preview:** `npm run server` runs a live‑reload server. Changes to posts or configs are reflected automatically.
- **New post:** Use `hexo new post "Title"` (or manually create a `.md` file in `source/_posts/` with proper front‑matter).
- **Asset management:** With `post_asset_folder: true`, placing images in the same‑name folder as the post allows referencing them via relative paths.
- **Math equations:** MathJax is enabled in `_config.archer.yml` (`math.mathjax.enable: true`).
- **Table of contents:** Enabled globally (`toc: true` in `_config.archer.yml`).

## Troubleshooting

- If the site fails to build, check for syntax errors in Markdown or YAML configs.
- If Algolia search returns no results, ensure the index has been updated (`npx hexo algolia`).
- If styles are missing, verify that the `theme: archer` line is present in `_config.yml`.

---
*This file was generated by Claude Code. Update it as the project evolves.*