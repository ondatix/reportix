# ondatix autoreport

TODO: Description

## Setup, Requirements & Deployment

TODO

## Config

TODO

## Template

TODO

## Modules

TODO

## Security & Privacy

All processing runs entirely in the browser. No data is ever transmitted to a server — uploaded files and generated reports stay local.

### Subresource Integrity (SRI)

All JavaScript and CSS assets are bundled at build time by Vite. No external CDN scripts are loaded at runtime, so there are no third-party resources to protect against. As an additional layer, `vite-plugin-sri3` appends `integrity=` hashes to every `<script>` and `<link>` tag in the built `index.html`, so a compromised static host cannot silently swap a built asset.

### Content Security Policy (CSP)

A strict CSP is applied in two complementary ways:

**1. `<meta>` tag (`index.html`)** — enforced by the browser for all deployments:

```
default-src 'self'; script-src 'self'; style-src 'self';
img-src 'self' data: blob:; font-src 'self';
connect-src 'none'; object-src 'none';
base-uri 'self'; form-action 'self';
```

`connect-src 'none'` is intentional: the app makes zero network requests at runtime, so any accidental fetch or XHR is blocked at the browser level.
`img-src data: blob:` is required for Chart.js canvas export and FileSaver file downloads.

**2. HTTP response header (`public/_headers`)** — used by Netlify and compatible static hosts. Extends the meta policy with `frame-ancestors 'none'` (which `<meta>` cannot set) and adds hardening headers:

```
Content-Security-Policy: ... frame-ancestors 'none'
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
```

For other hosts, translate `public/_headers` to the equivalent config (e.g. `vercel.json` `headers`, nginx `add_header`).

### HTTPS

HTTPS must be enforced at the hosting level. Enable "Force HTTPS" in your hosting provider's dashboard (Netlify, Vercel, Cloudflare Pages, and GitHub Pages all provide free automatic TLS). The `Strict-Transport-Security` header in `public/_headers` instructs browsers to always use HTTPS for this domain and opts the domain into browser preload lists once submitted to [hstspreload.org](https://hstspreload.org).

## Accessibility

TODO