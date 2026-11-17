const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const rooms = ['bathroom', 'bedroom', 'living_room', 'kitchen'];
const styles = ['scandinavian', 'minimalist', 'modern_classic', 'industrial'];
const problems = [];
const expected = new Map();
const fullHashes = new Set();
const photoHashes = new Map();
let total = 0;

function jpegSize(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 8) return null;
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  return null;
}

function digest(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

for (const room of rooms) for (const style of styles) for (let variant = 1; variant <= 3; variant++) {
  for (const suffix of ['', '-thumb']) {
    const key = `${room}-${style}-${variant}`;
    const name = `${key}${suffix}.jpg`;
    const file = path.join(root, 'assets', 'photos', name);
    expected.set(name, { key, collection: suffix ? 'bundledThumbnails' : 'bundledImages' });
    if (!fs.existsSync(file)) { problems.push(`Missing file: ${name}`); continue; }
    const bytes = fs.readFileSync(file);
    const size = jpegSize(bytes);
    const maxDimension = suffix ? 320 : 1600;
    if (!size || size.width < 1 || size.height < 1 || bytes.length < 1000) problems.push(`Invalid JPEG: ${name}`);
    else if (size.width > maxDimension || size.height > maxDimension) problems.push(`Oversized image: ${name} (${size.width} x ${size.height})`);
    const hash = digest(bytes);
    photoHashes.set(name, hash);
    if (!suffix) {
      if (fullHashes.has(hash)) problems.push(`Duplicate full image: ${name}`);
      fullHashes.add(hash);
    }
    total += bytes.length;
  }
}
const manifest = path.join(root, 'src', 'data', 'bundled-images.ts');
if (!fs.existsSync(manifest)) problems.push('Missing bundled-images.ts');
else {
  const source = fs.readFileSync(manifest, 'utf8');
  for (const collection of ['bundledImages', 'bundledThumbnails']) {
    const body = source.match(new RegExp(`export const ${collection}[^=]*=\\s*\\{([\\s\\S]*?)\\};`))?.[1];
    if (!body) { problems.push(`Missing manifest collection: ${collection}`); continue; }
    const entries = [...body.matchAll(/['"]([^'"]+)['"]\s*:\s*require\(['"]([^'"]+)['"]\)/g)];
    const seen = new Set();
    if (entries.length !== 48) problems.push(`${collection} contains ${entries.length} references; expected 48`);
    for (const [, key, relative] of entries) {
      const name = path.basename(relative);
      const target = expected.get(name);
      const resolved = path.resolve(path.dirname(manifest), relative);
      if (!target || target.key !== key || target.collection !== collection || resolved !== path.join(root, 'assets', 'photos', name)) problems.push(`Incorrect ${collection} reference: ${key} -> ${relative}`);
      if (seen.has(key)) problems.push(`Duplicate ${collection} key: ${key}`);
      seen.add(key);
    }
    for (const { key, collection: owner } of expected.values()) {
      if (owner === collection && !seen.has(key)) problems.push(`Missing ${collection} key: ${key}`);
    }
  }
}

if (process.argv.includes('--exports')) {
  for (const platform of ['android', 'ios']) {
    const directory = path.join(root, 'artifacts', platform);
    try {
      const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'metadata.json'), 'utf8'));
      const entry = metadata.fileMetadata[platform];
      const hashes = new Set(entry.assets.map(asset => digest(fs.readFileSync(path.join(directory, asset.path)))));
      for (const [name, hash] of photoHashes) {
        if (!hashes.has(hash)) problems.push(`${platform} export is missing ${name}`);
      }
      const bundleBytes = fs.statSync(path.join(directory, entry.bundle)).size;
      console.log(`${platform}: ${entry.assets.length} exported assets; ${(bundleBytes / 1024 / 1024).toFixed(2)} MiB Hermes bundle.`);
    } catch (error) { problems.push(`Cannot verify ${platform} export: ${error.message}`); }
  }
}

if (problems.length) {
  console.error(`Sample catalog audit failed (${problems.length} problems):\n${problems.join('\n')}`);
  process.exitCode = 1;
} else console.log(`48 distinct full images + 48 thumbnails and all manifest references verified; ${(total / 1024 / 1024).toFixed(2)} MiB total.${process.argv.includes('--exports') ? ' Both exports contain every catalog image.' : ''}`);
