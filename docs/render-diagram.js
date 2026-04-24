#!/usr/bin/env node

/**
 * Render Mermaid diagrams from markdown files
 * Usage: node render-diagram.js <input.md> [output.svg|output.png]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const inputFile = process.argv[2];
const outputFile = process.argv[3] || inputFile.replace('.md', '.svg');

if (!inputFile) {
  console.error('Usage: node render-diagram.js <input.md> [output.svg|output.png]');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`Error: File not found: ${inputFile}`);
  process.exit(1);
}

// Extract Mermaid diagram from markdown
const markdown = fs.readFileSync(inputFile, 'utf-8');
const mermaidMatch = markdown.match(/```mermaid\n([\s\S]*?)\n```/);

if (!mermaidMatch) {
  console.error('Error: No Mermaid diagram found in markdown file');
  process.exit(1);
}

const mermaidCode = mermaidMatch[1];
const diagramFile = path.join(path.dirname(inputFile), '.mermaid-temp.mmd');

// Write temporary diagram file
fs.writeFileSync(diagramFile, mermaidCode);

try {
  // Render using mmdc (mermaid-cli)
  const cmd = `npx @mermaid-js/mermaid-cli -i ${diagramFile} -o ${outputFile}`;
  console.log(`Rendering to: ${outputFile}`);
  execSync(cmd, { stdio: 'inherit' });
  console.log(`✓ Diagram rendered successfully`);
} catch (error) {
  console.error('Error rendering diagram. Make sure @mermaid-js/mermaid-cli is installed:');
  console.error('  npm install -g @mermaid-js/mermaid-cli');
  process.exit(1);
} finally {
  // Clean up temporary file
  if (fs.existsSync(diagramFile)) {
    fs.unlinkSync(diagramFile);
  }
}
