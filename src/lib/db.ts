import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

function cleanDatabaseUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed;
}

const connectionString =
  cleanDatabaseUrl(process.env.DATABASE_URL) ??
  cleanDatabaseUrl(process.env.POSTGRES_URL) ??
  cleanDatabaseUrl(process.env.PRISMA_DATABASE_URL);

if (!connectionString) {
  throw new Error("A PostgreSQL connection URL is required to use the dApp catalog.");
}

const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });
