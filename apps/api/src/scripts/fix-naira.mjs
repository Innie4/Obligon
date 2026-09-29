/**
 * Repairs naira signs that were written as mojibake.
 *
 * The naira sign is U+20A6, encoded UTF-8 as E2 82 A6. When those three bytes
 * were decoded as Windows-1252 they became U+00E2 U+201A U+00A6 — three
 * characters that render as "â‚¦" — and re-encoding that as UTF-8 baked the
 * corruption into the source file. Every other file in the repository holds the
 * correct single codepoint, so this is localised damage rather than a charset
 * problem, and it is fixed at the byte level rather than by string replacement.
 */
import fs from "node:fs";

const NAIRA = "\u20a6";
const files = process.argv.slice(2);
let repaired = 0;

for (const file of files) {
  const before = fs.readFileSync(file, "utf8");
  // The three mojibake codepoints that stand in for one naira sign.
  const after = before.replace(/[\u00e2][\u0080-\u00bf\u2018-\u201f][\u00a6]/g, NAIRA);
  if (after === before) continue;
  const count = (before.match(/[\u00e2][\u0080-\u00bf\u2018-\u201f][\u00a6]/g) ?? []).length;
  fs.writeFileSync(file, after, "utf8");
  console.log(`repaired ${count} naira sign(s) in ${file}`);
  repaired += count;
}
console.log(`\ntotal repaired: ${repaired}`);
