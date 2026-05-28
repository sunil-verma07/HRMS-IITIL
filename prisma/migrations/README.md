# Prisma Migrations

Create the first migration after configuring `DATABASE_URL`:

```bash
npm run prisma:migrate -- --name init
```

Production environments should use:

```bash
npm run prisma:deploy
```
