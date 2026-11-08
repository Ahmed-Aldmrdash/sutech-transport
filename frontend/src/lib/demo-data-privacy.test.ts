import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The demo and tests use made-up people only: the published bundle must never carry a real
 * student's or driver's number. Fake mobiles start 0100000, fake university IDs 2x01001.
 * The one real number allowed is the Transportation office's public line.
 */
const OFFICIAL_NUMBERS = new Set(["01040772030"]);
const FAKE_PHONE = /^0100000\d{4}$/;
const FAKE_UNIVERSITY_ID = /^2[456]0100\d{3}$/;

const ROOT = path.join(import.meta.dirname, "../..");
const FOLDERS = ["src", "e2e"];

function filesIn(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const full = path.join(folder, name);
    if (statSync(full).isDirectory()) return filesIn(full);
    return /\.(ts|tsx|json)$/.test(name) ? [full] : [];
  });
}

const sources = FOLDERS.flatMap((folder) => filesIn(path.join(ROOT, folder))).map((file) => ({
  file: path.relative(ROOT, file),
  text: readFileSync(file, "utf8"),
}));

describe("demo data privacy", () => {
  it("uses only fake mobile numbers (and the office's public line)", () => {
    const real = sources.flatMap(({ file, text }) =>
      [...text.matchAll(/(?<!\d)01[0125]\d{8}(?!\d)/g)]
        .map(([phone]) => phone)
        .filter((phone) => !FAKE_PHONE.test(phone) && !OFFICIAL_NUMBERS.has(phone))
        .map((phone) => `${file}: ${phone}`),
    );
    expect(real).toEqual([]);
  });

  it("uses only fake university IDs", () => {
    const real = sources.flatMap(({ file, text }) =>
      [...text.matchAll(/(?<!\d)2[456]0\d{6}(?!\d)/g)]
        .map(([id]) => id)
        .filter((id) => !FAKE_UNIVERSITY_ID.test(id))
        .map((id) => `${file}: ${id}`),
    );
    expect(real).toEqual([]);
  });
});
