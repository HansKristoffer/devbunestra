# Buncargo

Type-safe development environment CLI for Docker Compose-based projects. Handles container lifecycle, port isolation for git worktrees, and dev server orchestration. It's easy!

## Quick Start

### 1. Create `dev.config.ts` in your project root

```typescript
import { defineDevConfig } from 'buncargo'

export default defineDevConfig({
  projectPrefix: 'myapp',

  services: {
    postgres: {
      port: 5432,
      healthCheck: 'pg_isready',
      urlTemplate: ({ port }) => `postgresql://postgres:postgres@localhost:${port}/mydb`
    },
    redis: {
      port: 6379,
      healthCheck: 'redis-cli'
    }
  },

  apps: {
    api: {
      port: 3000,
      devCommand: 'bun run dev',
      cwd: 'apps/backend'
    },
    web: {
      port: 5173,
      devCommand: 'bun run dev',
      cwd: 'apps/frontend'
    }
  },

  envVars: (ports, urls) => ({
    DATABASE_URL: urls.postgres,
    REDIS_URL: urls.redis,
    API_PORT: ports.api
  }),

  hooks: {
    afterContainersReady: async (ctx) => {
      await ctx.exec('bunx prisma migrate deploy', { cwd: 'packages/prisma' })
    }
  },

  prisma: {
    cwd: 'packages/prisma'
  }
})
```

### 2. Run it

```bash
bunx buncargo dev           # Start containers + dev servers
bunx buncargo dev --up-only # Start containers only
bunx buncargo dev --down    # Stop containers
bunx buncargo dev --reset   # Stop and remove volumes
bunx buncargo typecheck     # Run TypeScript typecheck across workspaces
bunx buncargo prisma studio # Run prisma with correct DATABASE_URL
bunx buncargo env           # Print ports/urls as JSON
```

Or add scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "bunx buncargo dev",
    "dev:docker:down": "bunx buncargo dev --down",
    "typecheck": "bunx buncargo typecheck",
    "prisma": "bunx buncargo prisma"
  }
}
```

## Programmatic Access

Need ports/urls in your code (e.g., for tests)?

```typescript
import { loadDevEnv } from 'buncargo'

const env = await loadDevEnv()
console.log(env.ports.postgres)  // 5432 (or offset port)
console.log(env.urls.api)        // http://localhost:3000
console.log(env.urls.postgres)   // postgresql://...
```

## Features

### Worktree Isolation

Each git worktree automatically gets:

- Unique ports (offset 10-99)
- Unique Docker Compose project names

This means each worktree has isolated containers, networks, and volumes by default.

If you intentionally want shared Docker state across worktrees, set:

```typescript
options: {
  worktreeIsolation: false
}
```

### Health Checks

Built-in health checks for common services:

- `pg_isready` - PostgreSQL
- `redis-cli` - Redis
- `http` - HTTP endpoint check
- `tcp` - TCP port check

### URL Templates

Define connection URLs as functions:

```typescript
urlTemplate: ({ port, host, localIp }) => 
  `postgresql://user:pass@${host}:${port}/db`
```

Default templates exist for: `postgres`, `redis`, `clickhouse`, `mysql`, `mongodb`

### Lifecycle Hooks

```typescript
hooks: {
  afterContainersReady: async (ctx) => { /* Run migrations */ },
  beforeServers: async (ctx) => { /* Seed database */ },
  afterServers: async (ctx) => { /* Post-startup tasks */ },
  beforeStop: async (ctx) => { /* Cleanup */ }
}
```

### Hook Context

Hooks receive a context object with:

```typescript
interface HookContext {
  projectName: string
  ports: { postgres: number, api: number, ... }
  urls: { postgres: string, api: string, ... }
  root: string
  isCI: boolean
  portOffset: number
  localIp: string
  exec(cmd: string, opts?): Promise<ExecResult>
}
```

### Watchdog Auto-Shutdown

Containers automatically stop after 10 minutes of inactivity when running via CLI.

## CLI Reference

```
COMMANDS:
  dev                 Start the development environment
  typecheck           Run TypeScript typecheck across workspaces
  prisma <args>       Run Prisma CLI with correct DATABASE_URL
  env                 Print environment info as JSON
  help                Show help
  version             Show version

DEV OPTIONS:
  --up-only           Start containers only (no dev servers)
  --down              Stop containers
  --reset             Stop containers and remove volumes
  --migrate           Run migrations only
  --seed              Run seeders
```

## Environment Variables

The `envVars` function receives:

```typescript
envVars: (ports, urls, context) => ({
  // ports: { postgres: 5432, api: 3000, ... }
  // urls: { postgres: "postgresql://...", ... }
  // context: { localIp, portOffset, isCI, root }
})
```

These are injected into:
- Docker Compose (via `COMPOSE_PROJECT_NAME`)
- Dev server processes
- Hook `exec()` calls

## Docker Compose

Your `docker-compose.yml` should use environment variables for ports:

```yaml
services:
  postgres:
    image: postgres:16
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
```
