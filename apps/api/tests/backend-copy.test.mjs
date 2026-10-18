import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../src/", import.meta.url));

async function runtimeFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.filter(entry => !["migrations", "scripts"].includes(entry.name)).map(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? runtimeFiles(file) : entry.name.endsWith(".js") ? [file] : [];
  }));
  return files.flat();
}

test("backend presentation copy has no em dashes while legacy feature checks remain compatible", async () => {
  const offenders = [];
  const legacyChecks = new Set(["lib/subscriptions.js", "routes/customer.routes.js"]);
  for (const file of await runtimeFiles(root)) {
    const source = await readFile(file, "utf8");
    const relative = path.relative(root, file).split(path.sep).join("/");
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    function visit(node) {
      if ((ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) && node.text.includes("\u2014")) {
        // Historical plan records use this value to mean an excluded feature.
        const legacySentinel = node.text === "\u2014" && legacyChecks.has(relative) &&
          (ts.isBinaryExpression(node.parent) || ts.isArrayLiteralExpression(node.parent));
        if (!legacySentinel) offenders.push(`${relative}:${parsed.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(parsed);
  }
  assert.deepEqual(offenders, []);
});
