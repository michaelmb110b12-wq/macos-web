# macOS Web — Replit version

This branch adds Replit run/deployment configuration for the macOS Web Svelte app. It does not change the `main` branch.

## Run on Replit

1. Push this branch to GitHub (already available as `replit-version`).
2. In Replit, choose **Create Repl / Import from GitHub** and import:
   `https://github.com/michaelmb110b12-wq/macos-web/tree/replit-version`
   If Replit asks for a repository rather than a branch URL, import the repository and switch the workspace to the `replit-version` branch.
3. Let Replit install the Node.js dependencies.
4. Press **Run**. The configured command builds the Vite/Svelte frontend, then starts the Fastify server:
   `npm run build && npm start`
5. Open the web preview. The server binds to `0.0.0.0` and uses Replit's `PORT` environment variable.

## Notes

- Node.js 22 is configured because this project requires modern Node.js (package.json specifies Node >=20).
- The Fastify server serves the production build and provides the same-origin `/wisp/` WebSocket endpoint for the proxy.
- The proxy's remote destinations and third-party services still need to be reachable from Replit. Some sites/services may block proxy traffic.
- This branch's app links that explicitly point to GitHub Pages (for example, Optium) still point to those URLs. They are not automatically hosted inside Replit.
- For a deployment, use Replit's Deploy flow; the deployment command is configured to build and start the app.
