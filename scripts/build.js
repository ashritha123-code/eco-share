/**
 * Cross-platform build script for EcoCircle
 * Works on both Windows (local dev) and Linux (GitHub Actions CI)
 */

const fs = require('fs');
const path = require('path');

const wwwDir = path.join(__dirname, '..', 'www');

// Step 1: Remove existing www/ directory
if (fs.existsSync(wwwDir)) {
  fs.rmSync(wwwDir, { recursive: true, force: true });
  console.log('Cleaned existing www/ directory.');
}

// Step 2: Create www/ directory
fs.mkdirSync(wwwDir, { recursive: true });
console.log('Created www/ directory.');

// Step 3: Copy files
const root = path.join(__dirname, '..');

function copyFileIfExists(src, dest) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  Copied: ${path.basename(src)}`);
    return true;
  }
  return false;
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  console.log(`  Copied directory: ${path.basename(src)}/`);
}

// Copy core files
copyFileIfExists(path.join(root, 'index.html'), path.join(wwwDir, 'index.html'));
copyFileIfExists(path.join(root, 'styles.css'), path.join(wwwDir, 'styles.css'));

// Copy src/ directory
copyDirRecursive(path.join(root, 'src'), path.join(wwwDir, 'src'));

// Copy firebase config (prefer actual, fall back to template)
if (!copyFileIfExists(path.join(root, 'firebase-config.json'), path.join(wwwDir, 'firebase-config.json'))) {
  copyFileIfExists(path.join(root, 'firebase-config.json.template'), path.join(wwwDir, 'firebase-config.json'));
}

console.log('\n✅ Build complete! Output: www/');
