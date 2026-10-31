// Runs a TypeScript script with the project's "@/..." imports: node scripts/run-ts.mjs scripts/x.ts
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createJiti } from "jiti";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const jiti = createJiti(import.meta.url, { alias: { "@": root } });
await jiti.import(resolve(process.argv[2]));
