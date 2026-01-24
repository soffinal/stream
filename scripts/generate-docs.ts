#!/usr/bin/env bun
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const PATTERNS_DIR = "./patterns";
const PATTERNS_README = "./patterns/README.md";

interface Pattern {
  name: string;
  code: string;
  description: string;
  example: string;
}

// Read all patterns
const patterns: Pattern[] = [];
const dirs = readdirSync(PATTERNS_DIR).filter((d) => d !== "README.md");

for (const dir of dirs) {
  const patternPath = join(PATTERNS_DIR, dir, `${dir}.ts`);
  try {
    const content = readFileSync(patternPath, "utf-8");

    // Extract JSDoc description
    const descMatch = content.match(/\/\*\*\s*\n\s*\*\s*(.+?)\s*\n/);
    const description = descMatch ? descMatch[1] : dir;

    // Extract example from JSDoc
    const exampleMatch = content.match(/@example\s*\n\s*```typescript\s*\n(.+?)\n\s*```/s);
    const example = exampleMatch ? exampleMatch[1].trim() : `stream.pipe(${dir}())`;

    // Extract code (everything after imports and JSDoc)
    const codeMatch = content.match(/export const .+/s);
    const code = codeMatch ? codeMatch[0] : "";

    patterns.push({ name: dir, code, description, example });
  } catch (e) {
    console.warn(`Skipping ${dir}: ${e}`);
  }
}

// Sort patterns alphabetically
patterns.sort((a, b) => a.name.localeCompare(b.name));

// Generate patterns README
let markdown = `# Composable Patterns

Build your own transformers from primitives. All patterns are tested and ready to copy-paste.

**${patterns.length} patterns available**

## Quick Reference

`;

// Table of contents
for (const pattern of patterns) {
  markdown += `- [${pattern.name}](#${pattern.name}) - ${pattern.description}\n`;
}

markdown += "\n---\n\n";

// Full documentation
for (const pattern of patterns) {
  markdown += `## ${pattern.name}\n\n`;
  markdown += `${pattern.description}\n\n`;
  markdown += "**Usage:**\n\n";
  markdown += "```typescript\n";
  markdown += pattern.example;
  markdown += "\n```\n\n";
  markdown += "**Implementation:**\n\n";
  markdown += "```typescript\n";
  markdown += pattern.code;
  markdown += "\n```\n\n";
  markdown += "---\n\n";
}

writeFileSync(PATTERNS_README, markdown);
console.log(`✅ Generated patterns/README.md with ${patterns.length} patterns`);
