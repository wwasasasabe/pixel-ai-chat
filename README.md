# Pixel AI Chat

An open-source pixel-style AI chat template for Cloudflare Pages.

This repository contains the reusable app shell only: chat UI, local settings,
a Cloudflare Pages Function proxy, and a simple CSS pixel companion scene. It
does not include private story content, character lore, background music, or
proprietary visual assets.

## Features

- Static frontend built with HTML, CSS, and vanilla JavaScript
- Cloudflare Pages compatible
- Cloudflare Pages Function proxy for DeepSeek-compatible chat APIs
- Streaming assistant replies
- Local browser storage for messages, API key, base URL, model, and persona
- Generic CSS-only pixel companion scene
- No bundled private media assets

## Local Development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:8788
```

## Test

```bash
npm test
```

## Deploy

```bash
npm run deploy:pages
```

## API Keys

The app asks each user to enter their own API key in the browser. The key is
stored in localStorage and sent only to the Pages Function for the current
chat request. Do not hard-code shared API keys into frontend code.

## Customization

Replace the default persona, UI copy, and CSS companion with your own content.
If you add media assets, make sure you have the rights to publish them.

## License

MIT

