import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const regionStyles = JSON.parse(readFileSync(join(root, "public/data/region_styles.json"), "utf8"));
const words = JSON.parse(readFileSync(join(root, "public/data/words.json"), "utf8"));

const outputContent = `// Automatically generated from public/data JSON files.
window.DICTIONARY_DATA = {
  regionStyles: ${JSON.stringify(regionStyles, null, 2)},
  words: ${JSON.stringify(words, null, 2)}
};
`;

writeFileSync(join(root, "js/data.js"), outputContent, "utf8");
console.log("Successfully wrote js/data.js!");
