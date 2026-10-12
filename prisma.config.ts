import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ quiet: true }); // Prisma 7 no longer auto-loads .env; never overrides already-set vars

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
