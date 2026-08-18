import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    if (entry.name.includes(".test.")) return [];
    return /\.(?:ts|tsx)$/u.test(entry.name) ? [entryPath] : [];
  });
}

describe("production link prefetch policy", () => {
  it("routes every Next Link consumer through the central no-prefetch wrapper", () => {
    const files = ["src/app", "src/components"].flatMap((directory) =>
      sourceFiles(path.join(projectRoot, directory)),
    );
    const sources = files.map((file) => ({ file, source: readFileSync(file, "utf8") }));
    const relative = (file: string) => path.relative(projectRoot, file);
    const directNextImports = sources
      .filter(({ source }) => /from ["']next\/link["']/u.test(source))
      .map(({ file }) => relative(file));

    expect(directNextImports).toEqual(["src/components/SiteLink.tsx"]);
    for (const { file, source } of sources.filter(({ source }) => /<Link\b/u.test(source))) {
      expect(source, relative(file)).toMatch(/import Link from "@\/components\/SiteLink"/u);
    }

    const wrapper = sources.find(({ file }) => relative(file) === "src/components/SiteLink.tsx")?.source;
    expect(wrapper).toMatch(/process\.env\.NODE_ENV === "production" \? false : props\.prefetch/u);
    expect(wrapper).toMatch(/<NextLink \{\.\.\.props\} prefetch=\{prefetch\} \/>/u);
  });
});
