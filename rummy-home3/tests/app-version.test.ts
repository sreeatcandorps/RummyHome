import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { bundleSourceLabel, fullVersionLabel, helpVersionText, shortVersionLabel } from '../utils/appVersion';

const require = createRequire(import.meta.url);
const appJson = require('../app.json');
const easJson = require('../eas.json');
const appConfig = require('../app.config.js');

const resolveConfig = (env: string | undefined) => {
  const previous = process.env.EXPO_UPDATES_ENABLED;
  if (env === undefined) delete process.env.EXPO_UPDATES_ENABLED;
  else process.env.EXPO_UPDATES_ENABLED = env;
  try {
    return appConfig({ config: appJson.expo });
  } finally {
    if (previous === undefined) delete process.env.EXPO_UPDATES_ENABLED;
    else process.env.EXPO_UPDATES_ENABLED = previous;
  }
};

test('the Home header shows the installed version and build', () => {
  assert.equal(shortVersionLabel({ version: '1.1.0', build: '7' }), 'v1.1.0 (build 7)');
  assert.equal(fullVersionLabel({ version: '1.1.0', build: '7' }), 'EZ Score v1.1.0 (build 7)');
});

test('Expo Go and web, with no installed binary, still show something readable', () => {
  assert.equal(shortVersionLabel({ version: '1.1.0', build: null }), 'v1.1.0 (dev build)');
  assert.equal(shortVersionLabel({ version: null, build: null }), 'dev (dev build)');
});

test('Help says whether an over-the-air update replaced the embedded code', () => {
  assert.equal(bundleSourceLabel({ isEmbeddedLaunch: true, updateId: null }), 'Running the code built into this install.');
  assert.equal(
    bundleSourceLabel({ isEmbeddedLaunch: false, updateId: 'abcdef12-3456-7890-abcd-ef1234567890' }),
    'Running an over-the-air update (abcdef12).',
  );
  assert.match(
    helpVersionText({ version: '1.1.0', build: '7', isEmbeddedLaunch: true, updateId: null }),
    /^EZ Score v1\.1\.0 \(build 7\)\. Running the code built into this install\.$/,
  );
});

test('the app version was bumped so the new build is visibly different', () => {
  assert.notEqual(appJson.expo.version, '1.0.0');
  assert.match(appJson.expo.version, /^\d+\.\d+\.\d+$/);
});

test('EAS Update is off unless a build profile opts in', () => {
  assert.equal(appJson.expo.updates.enabled, false, 'the static config is the safe default');
  assert.equal(resolveConfig(undefined).updates.enabled, false, 'local runs');
  assert.equal(resolveConfig('false').updates.enabled, false, 'preview and development builds');
  assert.equal(resolveConfig('true').updates.enabled, true, 'production builds');
  assert.equal(resolveConfig('true').updates.url, appJson.expo.updates.url, 'the rest of the updates block is kept');
});

test('preview and development APKs always run their embedded JavaScript', () => {
  assert.equal(easJson.build.preview.env.EXPO_UPDATES_ENABLED, 'false');
  assert.equal(easJson.build.development.env.EXPO_UPDATES_ENABLED, 'false');
  assert.equal(easJson.build.production.env.EXPO_UPDATES_ENABLED, 'true');
});

test('each preview APK gets its own build number', () => {
  assert.equal(easJson.cli.appVersionSource, 'remote');
  assert.equal(easJson.build.preview.autoIncrement, true);
});
