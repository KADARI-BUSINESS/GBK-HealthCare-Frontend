# Frontend production and preview configuration

## API URL

Set `VITE_DEPLOYMENT_TARGET` to `production` or `preview` for every non-local
build, and set `VITE_API_BASE_URL` explicitly. Production also requires
`VITE_API_BASE_URL` to be the production API. Preview builds require
`VITE_PRODUCTION_API_BASE_URL` to identify the production API origin; the build
fails if the preview API shares that origin. Configure Amplify branch variables
independently and use a staging or other non-production API for every preview
branch. Rebuild after changing the variables because Vite embeds them in the
static bundle.

`VITE_API_BASE_URL` is public build configuration. Never put credentials or
secrets in `VITE_*` values.

## Amplify SPA rewrite

The application uses client-side routes including `/register`, `/verify-email`,
and `/pending-approval`. Configure this rewrite in Amplify Hosting's redirects
and rewrites list, before generic not-found rules. This file documents the
configuration only; it does not change AWS resources.

```json
[
  {
    "source": "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|svg|txt|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>",
    "status": "200",
    "target": "/index.html",
    "condition": null
  }
]
```
