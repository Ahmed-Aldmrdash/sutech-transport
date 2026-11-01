/**
 * Writes openapi.json from the Zod endpoint definitions: the contract the FastAPI team builds to.
 * Run with `npm run openapi`.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { buildOpenApiDocument } from "../src/lib/api/openapi";

const root = path.resolve(import.meta.dirname, "..");
const document = buildOpenApiDocument();
writeFileSync(path.join(root, "openapi.json"), `${JSON.stringify(document, null, 2)}\n`);
console.log(`Wrote openapi.json (${Object.keys(document.paths).length} paths)`);
