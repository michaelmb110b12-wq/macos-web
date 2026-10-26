# macOS Web — Replit static deployment

This branch configures the frontend for Replit Static Deployment and uses Anura's public Wisp endpoint instead of the custom Hostless proxy endpoint. The `main` branch is unchanged.

## Import into Replit

1. Open [Replit](https://replit.com/) and choose the option to import a project from GitHub.
2. Import `https://github.com/michaelmb110b12-wq/macos-web`.
3. Switch the workspace to the `replit-version` branch.
4. Allow Replit to install the dependencies.
5. Press **Run** to launch Vite's development preview.

## Deploy as a static site

1. Open **Deployments** in Replit.
2. Select **Static**.
3. Confirm the build command is `npm run build`.
4. Set the public directory to `dist`.
5. Publish/Deploy and wait for Replit to finish.

The `.replit` file already contains the static deployment settings and an SPA fallback to `/index.html`. The site is a Vite/Svelte frontend, so deployment serves the built files; it does not start `server.js` or `wisp-server.js`.

## Proxy notes

- The browser proxy defaults to Anura at `wss://anura.pro/`, rather than the custom Hostless Wisp URL.
- Static hosting does not run a custom WebSocket server. The proxy therefore depends on Anura's public endpoint being reachable and compatible with this app's Epoxy/libcurl transport. This external endpoint is configured but has not been tested from a deployed Replit site.
- The site still includes static Scramjet/BareMux assets in the Vite build. If Anura's endpoint, service-worker scope, or cross-origin policy is incompatible, the proxy may need additional changes.
- The Games app's Optium link remains the GitHub Pages URL currently configured in the app.

## Important

A static deployment can host the frontend only. It cannot run the app's Node/Fastify backend, host a private Wisp endpoint, or provide arbitrary WebSocket server code. To run your own Wisp server, use a server-capable deployment instead.
