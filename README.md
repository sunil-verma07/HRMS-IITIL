# IITIL HRMS + ATS Backend

Production-grade Node.js, Express.js, TypeScript, PostgreSQL, and Prisma backend for the IITIL Portal.

## Current Scope

This scaffold implements the foundation requested first:

- Enterprise folder structure
- Prisma data model for HRMS, ATS, onboarding, documents, notifications, activity logs, and audit logs
- Authentication module with JWT access tokens, hashed refresh-token sessions, refresh rotation, logout, forgot/reset password, first-login reset support, account lockout, and audit events
- RBAC module with users, roles, permissions, and role-permission joins
- Shared utilities for errors, API responses, validation, pagination, password hashing, token signing, geo-fencing distance checks, storage provider abstraction, logging, security middleware, and Prisma access
- Docker and Prisma seed setup

## Folder Structure

```text
src/
  app.ts
  server.ts
  common/
    errors/
    http/
    utils/
  config/
  database/
  events/
  interfaces/
  jobs/
  middlewares/
  modules/
    auth/
    rbac/
    employees/
    attendance/
    leaves/
    recruitment/
    dashboard/
    documents/
    notifications/
    audit/
  routes/
  services/
    storage/
  types/
prisma/
  schema.prisma
  seed.ts
```

## Architecture

The code follows feature-based clean architecture. Each production module should keep controllers thin, move orchestration into services, isolate Prisma access in repositories, and validate DTOs at the route boundary with Zod.

The schema is intentionally portal-scoped today. It avoids spreading `organizationId` across every table prematurely, while keeping entity boundaries, repository access, settings tables, and audit trails ready for a tenant-scope policy later.

## API Contract

Success response:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

Error response:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": []
}
```

## Auth Endpoints

Base path: `/api/v1/auth`

- `POST /login`
- `POST /refresh`
- `POST /logout`
- `POST /forgot-password`
- `POST /reset-password`
- `POST /change-password`
- `GET /me`

Refresh tokens are stored only as SHA-256 hashes. Rotation creates a replacement session and revokes the previous session. Token reuse revokes the entire session family.

## RBAC Endpoints

Base path: `/api/v1/rbac`

All endpoints require `rbac.manage`.

- `GET /roles`
- `POST /roles`
- `GET /permissions`
- `POST /assign-role`
- `POST /attach-permission`

Authorization uses permission codes, not hardcoded role checks.

## Local Setup

```bash
cp .env.example .env
docker compose up -d
npm install
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run dev
```

Seeded development admin:

- User ID: `admin`
- Password: `Admin@12345`

The seeded account is marked for password reset on first login.

## Module Expansion Pattern

For every module:

```text
module/
  module.controller.ts
  module.service.ts
  module.repository.ts
  module.routes.ts
  module.validation.ts
  module.dto.ts
  module.types.ts
```

Transactions belong in services when a use case mutates multiple aggregates, such as leave approval with balance updates or onboarding approval with credential generation.
