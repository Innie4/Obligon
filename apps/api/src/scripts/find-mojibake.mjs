import fs from "node:fs";
import path from "node:path";

const roots = process.argv.slice(2);
const SKIP = new Set(["node_modules", ".next", ".git", "dist", "build", "coverage"]);

// U+00E2 U+201A U+00A6 is the UTF-8 naira sign mis-decoded as cp1252.
const MOJIBAKE = /[\u00e2][\u0080-\u00bf\u2018-\u201f][\u00a6\u20a6]/g;
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|jsx|mjs|css|json|sql|html|md)$/.test(entry.name)) files.push(full);
  }
}
for (const r of roots) walk(r);

let total = 0;
for (const file of files) {
  const raw = fs.readFileSync(file);
  // Only judge the decoded text: a genuine U+20A6 is correct and must not be flagged.
  const text = raw.toString("utf8");
  const hits = [...text.matchAll(MOJIBAKE)];
  const genuine = (text.match(/\u20a6/g) ?? []).length;
  if (!hits.length && !genuine) continue;
  const rel = path.relative(process.cwd(), file);
  total += hits.length;
  console.log(`\n${rel}`);
  console.log(`  mojibake: ${hits.length}   correct U+20A6: ${genuine}`);
  const lines = text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (MOJIBAKE.test(line)) {
      MOJIBAKE.lastIndex = 0;
      console.log(`    L${idx + 1}: ${line.trim().slice(0, 110)}`);
    }
  });
  MOJIBAKE.lastIndex = 0;
}
console.log(`\nTOTAL mojibake sequences: ${total}`);
