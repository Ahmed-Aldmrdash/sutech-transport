import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : [`${prefix}${key}`, ...flatten(value, `${prefix}${key}.`)],
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

const ROOT = join(__dirname, "..");
const arKeys = new Set(flatten(ar as Tree));
const enKeys = new Set(flatten(en as Tree));

describe("messages", () => {
  it("Arabic and English have exactly the same keys", () => {
    expect([...arKeys].filter((key) => !enKeys.has(key))).toEqual([]);
    expect([...enKeys].filter((key) => !arKeys.has(key))).toEqual([]);
  });

  it("every translation key used in the code exists", () => {
    const missing: string[] = [];
    for (const file of ["app", "components", "features"].flatMap((dir) => sourceFiles(join(ROOT, dir)))) {
      const text = readFileSync(file, "utf8");
      const bindings = [...text.matchAll(/const (\w+) = useTranslations\("([\w.-]+)"\)/g)];
      // A binding covers the code until the next binding with the same name (one per component).
      bindings.forEach((binding, index) => {
        const [, name, namespace] = binding;
        const next = bindings.slice(index + 1).find((other) => other[1] === name);
        const scope = text.slice(binding.index, next?.index ?? text.length);
        for (const [, key] of scope.matchAll(new RegExp(`\\b${name}(?:\\.(?:rich|has))?\\("([\\w.-]+)"`, "g"))) {
          if (!arKeys.has(`${namespace}.${key}`)) missing.push(`${file.replace(ROOT, "")}: ${namespace}.${key}`);
        }
        for (const [, prefix] of scope.matchAll(new RegExp(`\\b${name}\\(\`([\\w.-]+)\\.\\$\\{`, "g"))) {
          if (!arKeys.has(`${namespace}.${prefix}`)) missing.push(`${file.replace(ROOT, "")}: ${namespace}.${prefix}.*`);
        }
      });
    }
    expect(missing).toEqual([]);
  });
});
