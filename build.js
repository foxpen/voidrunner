// Zkopíruje herní soubory do www/ pro Capacitor build
const fs   = require('fs');
const path = require('path');

const INCLUDE = [
  'index.html', 'menu.html', 'intro.html', 'onboarding.html',
  'css', 'js',
];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

// Vyčisti www/
fs.rmSync('www', { recursive: true, force: true });
fs.mkdirSync('www');

for (const item of INCLUDE) {
  const stat = fs.statSync(item, { throwIfNoEntry: false });
  if (!stat) { console.warn(`  skip: ${item} (nenalezen)`); continue; }
  if (stat.isDirectory()) {
    copyDir(item, path.join('www', item));
  } else {
    fs.copyFileSync(item, path.join('www', item));
  }
  console.log(`  copied: ${item}`);
}

console.log('\n  www/ připraven pro Capacitor\n');
