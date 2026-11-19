# yotuvia-web — VPS deployment

Two files: `deploy-web.sh` (build + publish the SPA) and
`nginx.yotuvia.conf` (the server block that serves it and proxies the API).

The repo root is not a git repository, so `docs/deployment/nginx.md` never
reached GitHub. This directory is the versioned copy.

## Why nginx is not optional

Three controls live only in the proxy:

1. **The SPA and `/uploads` share an origin.** An uploaded file inherits the
   app origin, and therefore `localStorage`, where the session tokens live. The
   API's CSP neutralizes a document it manages to serve; the subdomain split is
   the real defense. Keep it in mind before moving uploads back under the app.
2. **`frame-ancestors` is ignored in a `<meta>` tag.** The build injects the
   rest of the CSP in `<meta>`, but clickjacking protection must be a header.
3. **HSTS depends on a header.** The API emits it only when it sees
   `X-Forwarded-Proto: https`, which is this proxy's job.

## Build requirements

- `bun` available on the VPS
- `yotuvia-core` checked out as a sibling of `yotuvia-web`
- a `.env.production` with the production client ids:
  `VITE_GOOGLE_CLIENT_ID`, `VITE_FACEBOOK_APP_ID`
  (Vite bakes these at build time; `.env.local` is ALSO loaded in a production
  build, so leaving dev ids there ships them)

`YOTUVIA_API_URL` defaults to the same-origin `/api`, which is what nginx
proxies — do not point it at an absolute URL unless you accept CORS preflights.

## Cutting a release (recommended)

`.github/workflows/release.yml` builds core + web on every `v*` tag and attaches
`yotuvia-web-dist.tar.gz` plus its `.sha256` to the GitHub release:

```bash
git tag -a v1.0.0 -m "v1.0.0"
git push origin v1.0.0
```

The build needs these **repository Variables** (Settings > Secrets and
variables > Actions > Variables) because the runner has no `.env.production`:

| Variable | Effect when unset |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Google button disabled |
| `VITE_FACEBOOK_APP_ID` | Facebook button disabled |
| `YOTUVIA_TERMS_URL` | ships the `REPLACE-ME` placeholder |
| `YOTUVIA_PRIVACY_URL` | ships the `REPLACE-ME` placeholder |

`YOTUVIA_API_URL` is pinned to `/api` in the workflow (same-origin behind nginx).

## Deploy

```bash
# Recommended: publish the artifact CI built.
cd yotuvia-web
ARTIFACT_URL=https://github.com/Nina-99/yotuvia-web/releases/download/v1.0.0/yotuvia-web-dist.tar.gz \
  ./deploy/deploy-web.sh

# Or build on the server (needs bun + the core checkout as a sibling).
./deploy/deploy-web.sh
```

`rsync -a --delete` publishes to `/srv/yotuvia/web`. `index.html` is served with
`Cache-Control: no-store`, so a new deploy is picked up on the next navigation;
hashed assets are immutable.

## nginx

```bash
sudo cp deploy/nginx.yotuvia.conf /etc/nginx/sites-available/yotuvia.conf
sudo ln -s /etc/nginx/sites-available/yotuvia.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d yotuvia.com
```

## Verify

```bash
# transport headers
curl -sI https://yotuvia.com/ | grep -Ei 'strict-transport|content-security|x-frame|nosniff'

# an uploaded .html must NOT be served as a document
curl -sI https://yotuvia.com/uploads/receipts/x.html | grep -i content-type
# expected: application/octet-stream

# readiness through the proxy
curl -fsS https://yotuvia.com/api/healthz
```
