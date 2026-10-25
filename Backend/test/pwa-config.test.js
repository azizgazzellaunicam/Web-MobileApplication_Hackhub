const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const frontendRoot = path.join(__dirname, '..', '..', 'frontend');

test('defines an installable manifest and production Angular service worker', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(frontendRoot, 'public', 'manifest.webmanifest'), 'utf8'));
  const angularConfig = JSON.parse(fs.readFileSync(path.join(frontendRoot, 'angular.json'), 'utf8'));
  const ngswConfig = JSON.parse(fs.readFileSync(path.join(frontendRoot, 'ngsw-config.json'), 'utf8'));
  const production = angularConfig.projects.Esercizio2.architect.build.configurations.production;

  assert.equal(manifest.name, 'HackHub');
  assert.equal(manifest.short_name, 'HackHub');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192'));
  assert.equal(production.serviceWorker, 'ngsw-config.json');
  assert.deepEqual(ngswConfig.assetGroups.map((group) => group.name), ['app', 'assets']);
  assert.ok(ngswConfig.assetGroups[0].resources.files.includes('/manifest.webmanifest'));
  assert.ok(!ngswConfig.assetGroups.some((group) => group.resources?.urls?.some((url) => url.includes('/api'))));
});
