import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

function cleanDatabaseUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed;
}

const databaseUrl =
  cleanDatabaseUrl(process.env.DIRECT_URL) ??
  cleanDatabaseUrl(process.env.POSTGRES_URL) ??
  cleanDatabaseUrl(process.env.PRISMA_DATABASE_URL) ??
  cleanDatabaseUrl(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL, POSTGRES_URL, or PRISMA_DATABASE_URL must be set before running Prisma commands.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
