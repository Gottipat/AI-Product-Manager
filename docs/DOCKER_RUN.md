# Docker Run Guide

This guide gets the project running for teammates with Docker, including environment setup, first-time bootstrapping, and the optional bot runner.

## What Runs In Docker

The default stack starts:

- `web` on `http://localhost:3001`
- `ai-backend` on `http://localhost:3002`
- `postgres` on `localhost:5432`

The optional `bot-runner` is available through a Docker Compose profile because it needs extra credentials and a meeting link.

## Prerequisites

- Docker Desktop or Docker Engine with Compose support
- An OpenAI API key

Optional for bot mode:

- A Google Meet link
- A Google account the bot can use to sign in

## 1. Prepare Environment Variables

Copy the Docker env template:

```bash
cp .env.docker.example .env.docker
```

Open `.env.docker` and set at least:

```env
OPENAI_API_KEY=sk-your-openai-key
JWT_SECRET=some-long-random-secret
COOKIE_SECRET=another-long-random-secret
```

Important variables:

- `NEXT_PUBLIC_API_URL`
  Use `http://localhost:3002/api/v1` for normal local Docker usage.
- `DATABASE_URL`
  The default already points to the Docker Postgres service.
- `AI_BACKEND_PORT`
  Defaults to `3002`.
- `WEB_PORT`
  Defaults to `3001`.

Optional bot variables:

```env
MEET_LINK=https://meet.google.com/your-link
GOOGLE_EMAIL=bot-account@example.com
GOOGLE_PASSWORD=your-password
BOT_DISPLAY_NAME=Meeting AI Bot
HEADLESS=true
```

## 2. Start The Core Stack

```bash
docker compose --env-file .env.docker up --build
```

This will:

- build the monorepo images
- start PostgreSQL
- push the Drizzle schema into the database
- seed the default development organization
- start the backend
- build and start the Next.js dashboard

## 3. Open The App

- Web dashboard: `http://localhost:3001`
- API health check: `http://localhost:3002/api/v1/health`

## 4. First-Time App Usage

On first run:

1. Open `http://localhost:3001`
2. Sign up with any email and password
3. Create a project
4. Upload a transcript or use the meeting capture flow

The Docker startup seeds a default development organization automatically, and new signups are attached to it by default so project creation works immediately.

## 5. Run The Bot Runner

The bot runner is optional and disabled by default.

After setting the bot-related variables in `.env.docker`, start it with:

```bash
docker compose --env-file .env.docker --profile bot up --build
```

If you already have the core stack running and only want to start the bot service:

```bash
docker compose --env-file .env.docker --profile bot up --build bot-runner
```

Notes:

- The bot runner talks to the backend through the internal Docker network.
- It will exit if `MEET_LINK` is missing.
- If Google Meet blocks guest access, provide `GOOGLE_EMAIL` and `GOOGLE_PASSWORD`.

## Useful Commands

Start in background:

```bash
docker compose --env-file .env.docker up --build -d
```

Stop everything:

```bash
docker compose --env-file .env.docker down
```

Stop and remove database volume too:

```bash
docker compose --env-file .env.docker down -v
```

View logs:

```bash
docker compose --env-file .env.docker logs -f
```

Rebuild after Dockerfile or dependency changes:

```bash
docker compose --env-file .env.docker build --no-cache
```

## Troubleshooting

### Backend does not start

Check:

```bash
docker compose --env-file .env.docker logs ai-backend
```

Common causes:

- missing `OPENAI_API_KEY`
- invalid `DATABASE_URL`
- Postgres still booting

### Web cannot call the backend

Check `.env.docker`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3002/api/v1
```

This value is used by the browser, so it must point to the host-exposed backend URL, not `http://ai-backend:3002`.

### Project creation fails after signup

The backend should auto-seed the default development organization. If you suspect startup was interrupted, restart the backend:

```bash
docker compose --env-file .env.docker restart ai-backend
```

### Bot runner exits immediately

That usually means one of these is missing:

- `MEET_LINK`
- `OPENAI_API_KEY`
- Google credentials, when the meeting blocks guest access

## Recommended Team Workflow

1. Copy `.env.docker.example` to `.env.docker`
2. Add the shared OpenAI key or your personal dev key
3. Start the core stack with Docker Compose
4. Sign up in the UI
5. Upload transcripts and verify MoM generation
6. Only enable the bot profile if you need automated Meet joining
