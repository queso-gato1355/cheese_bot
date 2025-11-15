Deployment notes for Synology Docker + GitHub Actions

Overview
- Container restart: the provided `docker-compose.yml` sets `restart: unless-stopped` so Docker will restart the container after host reboot or crash.
- Auto-update: optional `watchtower` service is included. It will pull and restart containers when a new image is published to the registry.

CI/CD (GitHub Actions)
- Workflows (see `.github/workflows/deploy.yml`) build and push images to GitHub Container Registry (GHCR) and notify a Discord webhook about deployment progress.
- For `main` branch, the workflow pushes a production image and notifies production channels.
- For `development` branch, the workflow tags the image as `dev` and the bot will register commands only in `DEV_GUILD_ID` (test server) when started with `DEPLOY_TARGET=development`.

How to run on Synology
1. Copy repository to Synology or clone it there.
2. Create a `.env` file (see `.env.example`) and fill values.
3. Start with docker-compose:

    docker-compose up -d --build

4. (Optional) Make sure Docker is allowed persistent restart and the `watchtower` container has access to Docker socket.

Security
- For GitHub Actions to notify Discord, create a Discord Incoming Webhook and store it in the repo secret `DISCORD_WEBHOOK_URL`.
- For GHCR pushes, the workflow uses `GITHUB_TOKEN` by default; for other registries, add credentials as secrets.

PostgreSQL & Prisma
- Add a `DATABASE_URL` environment variable to your `.env` file on the host. Example in `.env.example`.
- To initialize the database locally (for development), install dev deps and run:

    npm install
    npx prisma generate
    npx prisma db push # or `npx prisma migrate dev --name init` to create a migration

- The Prisma client is exposed at `src/prismaClient.js` and the schema is at `prisma/schema.prisma`.
