# Client

The Angular 21 single-page app for Mortgage Analytics. How it is built is in
[docs/05-frontend.md](../docs/05-frontend.md); every command is in [docs/02-commands.md](../docs/02-commands.md).

Run these from this folder (Node 22+). The API must be running on port 5080 for `npm start`; the dev server
proxies `/api` to it (`proxy.conf.json`).

```bash
npm ci              # install the exact versions in package-lock.json
npm start           # dev server on http://localhost:4200, reloads on save
npm run lint        # angular-eslint: TypeScript and template rules
npm test            # Jest unit tests; fails below 85% coverage
npm run e2e         # Playwright end-to-end tests, including axe accessibility scans; starts the API and the app
npm run build       # production build into dist/client/browser (the Docker image serves it from the API)
```
