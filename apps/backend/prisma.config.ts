import { defineConfig } from "prisma/config";
import dotenv from "dotenv";
import path from "path";

// Explicitly load .env from apps/backend/.env
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
