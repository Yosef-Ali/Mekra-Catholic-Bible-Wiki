
import fs from 'fs';

const FULL_TEXT = 'full_text.txt';

function extract(startLine: number, endLine: number, outFile: string) {
  console.log(`Extracting lines ${startLine}-${endLine} to ${outFile}`);
  const content = fs.readFileSync(FULL_TEXT, 'utf-8');
  const lines = content.split('\n');
  const subset = lines.slice(startLine - 1, endLine); // 0-indexed vs 1-indexed
  fs.writeFileSync(outFile, subset.join('\n'));
  console.log(`Saved ${subset.length} lines.`);
}

const args = process.argv.slice(2);
if (args.length === 3) {
  extract(parseInt(args[0]), parseInt(args[1]), args[2]);
} else {
  console.log("Usage: tsx scripts/split_text.ts <StartLine> <EndLine> <OutFile>");
}
