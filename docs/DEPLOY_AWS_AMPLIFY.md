# Deploy ARCANA SURVIVOR to AWS Amplify Hosting

ARCANA SURVIVOR is a **static, client-side web game**. It does not need an Amplify backend, Node server, AWS credentials in the repository, or a database to run the current demo.

## First deployment (AWS Console)

1. Open https://console.aws.amazon.com/amplify/apps and choose **Create new app / Host web app**.
2. Choose **GitHub**, authorize the AWS Amplify GitHub App, and grant it access to `tanawutmalirum29-ux/ARCANA-SURVIVOR`.
3. Select the repository and **`main` branch**. Leave the repository root as the app root (this is not a monorepo).
4. Use the default **Amazon Linux 2023** build image (supports Node.js 22). Amplify reads **`amplify.yml`** at the repository root:
   - Node.js: 22 (`nvm use 22`)
   - Build: `npm run check` (unit tests + static build)
   - Output/artifact directory: **`dist`**
5. Choose **Save and deploy**. When deployment succeeds, open the provided `https://...amplifyapp.com` URL.

Changes pushed to **`main`** will automatically trigger a new deployment once GitHub is connected to Amplify.

## Local verification

Use Node.js 22:

```sh
npm run check
```

The build produces `dist/index.html` and `dist/src/`. Host the **contents of `dist/`** as a static website. Do not use the repository root as the Amplify publish directory.

## Quick troubleshooting

- **Build fails at `nvm use 22`**: select the Amazon Linux 2023 build image; it supports Node.js 22.
- **Build fails at tests**: inspect the `npm run check` output; deployment intentionally stops when tests fail.
- **404 / missing JS or CSS**: verify the artifact directory is `dist` and Amplify is using the committed `amplify.yml`.
- **Repository not listed**: allow access to this repository in the AWS Amplify GitHub App installation.
- **Game saves**: currently browser-local (localStorage), not synchronized across devices.
- **Real payments, server-side events, accounts, and multiplayer**: not implemented in this demo; hosting does not add those features.

The current game has no client-side URL router; therefore **no SPA rewrite rule is necessary**. Revisit redirects/rewrites if URL-based navigation is introduced later.
