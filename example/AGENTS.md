# Buncargo Config Guide (Docker + Seed + Maintenance)

This guide explains how to create and maintain `dev.config.ts` for `buncargo` in a simple, typed, and repeatable way.

## Standalone Setup (from scratch)

Use this section if you are starting in a project with no existing buncargo setup.

### 1) Install buncargo

```bash
bun add -d buncargo
```

### 2) Create config file in repo root

Create one of these files in the project root:

- `dev.config.ts` (recommended)
- `dev.config.js`
- `dev-tools.config.ts`
- `dev-tools.config.js`

Use `dev.config.ts` unless you have a reason to choose another name.

### 3) Add package scripts

```json
{
  "scripts": {
    "dev": "bunx buncargo dev",
    "dev:up": "bunx buncargo dev --up-only",
    "dev:down": "bunx buncargo dev --down",
    "dev:reset": "bunx buncargo dev --reset",
    "dev:env": "bunx buncargo env"
  }
}
```

### 4) Create your first `dev.config.ts`

```ts
import { defineDevConfig, service } from "buncargo";

export default defineDevConfig({
	projectPrefix: "myapp",
	services: {
		postgres: service.postgres({ database: "myapp" }),
	},
	envVars: (_ports, urls) => ({
		DATABASE_URL: urls.postgres,
	}),
});
```

### 5) Start and verify

```bash
bun run dev
```

Expected results:

- Containers start from generated compose.
- Services are reachable on computed ports.
- Generated compose file appears at `.buncargo/docker-compose.generated.yml` (default path).

## Core Rules

- Define everything in `dev.config.ts`.
- Do not maintain a manual root `docker-compose.yml`.
- Use `service.*` helpers for built-in services whenever possible.
- Use `service.custom(...)` for non-built-in services.

## Minimal Config Template

```ts
import { defineDevConfig, service } from "buncargo";

export default defineDevConfig({
	projectPrefix: "myapp",
	services: {
		postgres: service.postgres({ database: "myapp" }),
	},
	envVars: (_ports, urls) => ({
		DATABASE_URL: urls.postgres,
	}),
});
```

## Service Setup

### Built-in typed services

Use these first:

- `service.postgres(...)`
- `service.redis(...)`
- `service.clickhouse(...)`

Example:

```ts
services: {
	postgres: service.postgres({ database: "geysier" }),
	redis: service.redis(),
	clickhouse: service.clickhouse({ database: "geysier" }),
}
```

### Custom service

Use this for anything else:

```ts
services: {
	nats: service.custom({
		port: 4222,
		healthCheck: false,
		docker: {
			image: "nats:2-alpine",
			ports: ["${NATS_PORT:-4222}:4222"],
		},
	}),
}
```

## Docker Generation

`buncargo` generates compose from config and runs Docker with the generated file.

Optional docker block:

```ts
docker: {
	generatedFile: ".buncargo/docker-compose.generated.yml",
	writeStrategy: "always", // or "if-missing"
	volumes: {
		shared_cache: {},
	},
}
```

### What gets generated automatically

- Service images for built-ins
- Port mappings from computed `*_PORT` variables
- Built-in health checks
- Volumes (`postgres_data`, `clickhouse_data`, etc.)
- Environment fields for built-ins (`POSTGRES_DB`, `CLICKHOUSE_DB`, etc.)

## Apps and Environment Variables

Define app processes and all env vars in one place:

```ts
apps: {
	api: {
		port: 3000,
		devCommand: "bun run dev",
		cwd: "apps/backend",
		healthEndpoint: "/health",
	},
	platform: {
		port: 5173,
		devCommand: "bun run dev",
		cwd: "apps/platform",
		healthEndpoint: "/",
	},
},
envVars: (ports, urls, { localIp }) => ({
	DATABASE_URL: urls.postgres,
	VITE_API_URL: urls.api,
	CLICKHOUSE_NATIVE_PORT: ports.clickhouseSecondary,
	EXPO_PUBLIC_API_URL: `http://${localIp}:${ports.api}`,
}),
```

## Migrations, Seed, Prisma

### Migrations

```ts
migrations: [
	{ name: "prisma", command: "bunx prisma migrate deploy", cwd: "packages/prisma" },
	{ name: "clickhouse", command: "bun apps/backend/src/lib/clickhouse/run-ch-migrate.ts" },
],
```

### Seed

```ts
seed: {
	command: "bun run run:seeder",
	check: ({ checkTable }) => checkTable("User", "postgres"),
},
```

### Prisma integration

```ts
prisma: {
	cwd: "packages/prisma",
	// optional:
	// service: "postgres",
	// urlEnvVar: "DATABASE_URL",
},
```

## Lifecycle Hooks (maintenance tasks)

Use hooks to keep maintenance logic close to config:

```ts
hooks: {
	afterContainersReady: async (ctx) => {
		await ctx.exec("bun run health:check");
	},
	beforeServers: async (ctx) => {
		await ctx.exec("bun run cache:warm");
	},
	beforeStop: async (ctx) => {
		await ctx.exec("bun run cleanup:temp", { throwOnError: false });
	},
},
```

## Recommended Maintenance Checklist

- Keep `projectPrefix` stable for predictable Docker project names.
- Prefer built-in service helpers over raw Docker objects.
- Keep all connection vars in `envVars`.
- Keep migration/seed commands idempotent.
- Review generated compose diff when changing service settings.
- Add/update tests when adding new custom service patterns.

## Troubleshooting

- **Service has no Docker definition**: use a built-in helper or `service.custom(...)`.
- **Wrong ports**: verify `port` / `secondaryPort` and env var usage.
- **Seed not running**: check `seed.check` return value and service name.
- **Prisma command fails**: confirm `prisma.cwd` and `DATABASE_URL` mapping.
- **Compose file not updating**: set `docker.writeStrategy` to `"always"`.

## Full Platform Example

See:

- `example/platform.dev.config.ts`
- `example/custom-services.dev.config.ts`
- `example/minimal.dev.config.ts`
