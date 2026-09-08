import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDappStoreDeepLink } from '../src/dist/lib/dapps/deep-link.js';
import { normalizeDiscoveredDapp } from '../src/dist/lib/dapps/normalize.js';
import { rankDappForPulse } from '../src/dist/lib/dapps/ranking.js';
import { detectDappSearchIntent, recommendDappsForMessage } from '../src/dist/lib/dapps/ai.js';
import { findCandidateDapps } from '../src/dist/lib/dapps/search.js';
import { validateDiscoveredDapp } from '../src/dist/lib/dapps/validate.js';
import { VerifiedSolanaMobileCatalogProvider } from '../src/dist/lib/dapps/discovery.js';

const sample = {
  source: 'official-seed',
  sourceId: 'com.example.app',
  name: 'Example Wallet',
  description: 'Secure wallet and staking app for Solana',
  shortDescription: 'Wallet & staking',
  website: 'https://example.com',
  packageName: 'com.example.app',
  developerName: 'Example Labs',
  categories: ['wallet', 'defi'],
  tags: ['staking', 'solana'],
  isSeekerCompatible: true,
  status: 'active',
  releases: [{ version: '1.2.3', packageName: 'com.example.app' }],
};

test('buildDappStoreDeepLink returns official deep link for valid package', () => {
  assert.equal(buildDappStoreDeepLink('com.example.app'), 'solanadappstore://details?id=com.example.app');
});

test('buildDappStoreDeepLink rejects invalid package names', () => {
  assert.equal(buildDappStoreDeepLink('https://evil.com'), null);
  assert.equal(buildDappStoreDeepLink(''), null);
});

test('validation rejects fabricated or malformed package names', () => {
  assert.equal(validateDiscoveredDapp({ source: 'test', name: 'Example', packageName: 'Example App' }).valid, false);
  assert.equal(validateDiscoveredDapp({ source: 'test', name: 'Example', packageName: 'com.example.app' }).valid, true);
});

test('verified provider does not invent a catalog', async () => {
  assert.deepEqual(await new VerifiedSolanaMobileCatalogProvider().discoverDapps(), []);
});

test('normalizeDiscoveredDapp trims and normalizes fields', () => {
  const normalized = normalizeDiscoveredDapp(sample);
  assert.equal(normalized.name, 'Example Wallet');
  assert.equal(normalized.packageName, 'com.example.app');
  assert.deepEqual(normalized.categories, ['wallet', 'defi']);
  assert.deepEqual(normalized.tags, ['staking', 'solana']);
});

test('rankDappForPulse returns a stable score', () => {
  const ranked = rankDappForPulse({
    isActive: true,
    isVerified: true,
    isSeekerCompatible: true,
    description: 'A solid app',
    shortDescription: 'Solid',
    website: 'https://example.com',
    packageName: 'com.example.app',
    releases: [{ version: '1.0.0', releaseDate: '2024-12-01' }],
  });
  assert.ok(ranked >= 0 && ranked <= 100);
});

test('detectDappSearchIntent extracts staking and asset intent', () => {
  const intent = detectDappSearchIntent('I need an app to stake SKR');
  assert.equal(intent.intent, 'staking');
  assert.ok(intent.assets.includes('SKR'));
  assert.ok(intent.categories.includes('defi'));
});

test('recommendDappsForMessage returns structured recommendations', () => {
  const result = recommendDappsForMessage('I need an app to stake SKR', [sample]);
  assert.equal(result.answer.includes('staking') || result.answer.includes('SKR') || result.answer.length > 0, true);
  assert.ok(result.recommendations.length >= 1);
  assert.equal(result.recommendations[0].dappId, 'com.example.app');
});

test('recommendDappsForMessage prioritizes exact name and asset matches', () => {
  const results = recommendDappsForMessage('I want to stake SKR', [
    { id: 'generic', name: 'Wallet Hub', description: 'A general Solana wallet', categories: ['defi'], tags: ['wallet'], packageName: 'com.generic.app' },
    { id: 'skr', name: 'SKR Staking', description: 'Stake SKR and track rewards', categories: ['defi'], tags: ['staking'], packageName: 'com.skr.staking' },
  ]);
  assert.equal(results.recommendations[0].dappId, 'skr');
  assert.match(results.recommendations[0].reason, /SKR|stake/i);
});

test('findCandidateDapps filters by text and categories', () => {
  const dapps = [
    { ...sample, id: '1', name: 'Example Wallet', categories: ['wallet'], tags: ['staking'] },
    { ...sample, id: '2', name: 'Nft City', categories: ['nft'], tags: ['minting'] },
  ];
  const results = findCandidateDapps(dapps, { query: 'staking', category: 'wallet', limit: 10 });
  assert.equal(results.length, 1);
  assert.equal(results[0].id, '1');
});
