import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export const hasDatabase = Boolean(process.env.DATABASE_URL);
export const db = hasDatabase ? drizzle(neon(process.env.DATABASE_URL!), { schema }) : null;

export const memberSeed = [
  { slug: "patrick", name: "Patrick" },
  { slug: "ionut", name: "Ionut" },
  { slug: "igor", name: "Igor" },
  { slug: "andrei", name: "Andrei" },
] as const;
