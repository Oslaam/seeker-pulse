import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDappStoreDeepLink } from '../src/dist/lib/dapps/deep-link.js';
import { normalizeDiscoveredDapp } from '../src/dist/lib/dapps/normalize.js';
import { rankDappForPulse } from '../src/dist/lib/dapps/ranking.js';
import { detectDappSearchIntent, recommendDappsForMessage } from '../src/dist/lib/dapps/ai.js';
import { findCandidateDapps, mergeCandidateDappGroups } from '../src/dist/lib/dapps/search.js';
import { validateDiscoveredDapp } from '../src/dist/lib/dapps/validate.js';
import { VerifiedSolanaMobileCatalogProvider } from '../src/dist/lib/dapps/discovery.js';
import { shouldAutoFillLookupInput } from '../src/dist/lib/ui-state.js';
import { buildJourneySummary } from '../src/dist/lib/exploration.js';
import { dappMetadataChanged } from '../src/dist/lib/dapps/sync.js';
import { getDappSource } from '../src/dist/lib/dapps/sync.js';
import { RemoteCatalogProvider } from '../src/dist/lib/dapps/remote-provider.js';

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

test('detectDappSearchIntent recognizes general SKR discovery', () => {
  const intent = detectDappSearchIntent('What can I do with SKR?');
  assert.equal(intent.intent, 'skr_discovery');
  assert.ok(intent.assets.includes('SKR'));
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

test('recommendDappsForMessage uses full descriptions and related word forms', () => {
  const results = recommendDappsForMessage('I want something for liquid staking', [
    { id: 'generic', name: 'Wallet Hub', description: 'A general wallet for Solana', categories: ['wallet'], tags: ['wallet'], packageName: 'com.generic.app' },
    { id: 'liquid', name: 'Waterfall', description: 'Liquid staking with automated rewards', categories: ['defi'], tags: ['staking'], packageName: 'com.liquid.app' },
  ]);
  assert.equal(results.recommendations[0].dappId, 'liquid');
  assert.match(results.recommendations[0].reason, /liquid|staking/i);
});

test('recommendDappsForMessage labels SKR matches as verified metadata', () => {
  const result = recommendDappsForMessage('What can I do with SKR?', [
    { id: 'skr', name: 'SKR Staking', description: 'Stake SKR and track rewards', categories: ['defi'], tags: ['staking'], packageName: 'com.skr.staking' },
  ]);
  assert.match(result.answer, /verified.*SKR|SKR.*verified/i);
  assert.match(result.recommendations[0].reason, /verified app metadata/i);
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

test('findCandidateDapps searches name, subtitle, and full description', () => {
  const results = findCandidateDapps([
    { id: 'subtitle', name: 'Orbit', shortDescription: 'Liquid staking', description: 'A simple Solana app', categories: ['defi'], tags: [] },
    { id: 'description', name: 'Harbor', shortDescription: 'A wallet', description: 'Track NFT collections and floor prices', categories: ['nft'], tags: [] },
  ], { query: 'liquid staking', limit: 10 });
  assert.equal(results[0].id, 'subtitle');
  assert.equal(findCandidateDapps([{ id: 'description', name: 'Harbor', shortDescription: 'A wallet', description: 'Track NFT collections and floor prices', categories: [], tags: [] }], { query: 'floor prices', limit: 10 })[0].id, 'description');
});

test('merged keyword results retain Play Seeke as a gaming candidate', () => {
  const playSeeke = {
    id: 'xyz.seeke',
    name: 'Play Seeke',
    shortDescription: 'Play, progress, and earn on Solana',
    description: 'A wallet-powered gaming app with fast mini-games.',
    categories: [],
    tags: [],
  };
  const pool = mergeCandidateDappGroups([
    [{ id: 'other-game', name: 'Other Game', categories: [], tags: [] }, playSeeke],
    [playSeeke],
  ]);
  const results = findCandidateDapps(pool, { query: 'play game gaming', limit: 50 });

  assert.equal(pool.filter((dapp) => dapp.id === 'xyz.seeke').length, 1);
  assert.equal(results[0].id, 'xyz.seeke');
});

test('catalog sync detects changed reviews and descriptions', () => {
  assert.equal(dappMetadataChanged({ rating: 4.1, reviewCount: 8, description: 'Old copy' }, { rating: 4.6, reviewCount: 19, description: 'New copy' }), true);
  assert.equal(dappMetadataChanged({ rating: 4.1, reviewCount: 8, description: 'Same copy' }, { rating: 4.1, reviewCount: 8, description: 'Same copy' }), false);
});

test('remote catalog sync cleanup uses the source stored on imported dApps', () => {
  assert.equal(getDappSource(new RemoteCatalogProvider()), 'seekertracker-snapshot');
});

test('connected wallet state does not auto-fill the public .skr lookup input', () => {
  assert.equal(shouldAutoFillLookupInput({ connectedAddress: 'CfRjo855LvAWcviiiq7DdcLz9i5Xqy8Vvnmh95UnL9Ua', explicitUserIntent: false }), false);
  assert.equal(shouldAutoFillLookupInput({ connectedAddress: 'CfRjo855LvAWcviiiq7DdcLz9i5Xqy8Vvnmh95UnL9Ua', explicitUserIntent: true }), true);
  assert.equal(shouldAutoFillLookupInput({ connectedAddress: null, explicitUserIntent: false }), false);
});

test('journey summary distinguishes opened and explored app activity from on-chain detection', () => {
  const summary = buildJourneySummary([
    { dappId: 'alpha', dappName: 'Alpha Swap', category: 'defi', firstOpenedAt: '2026-09-10T14:00:00.000Z', lastOpenedAt: '2026-09-18T18:00:00.000Z', openCount: 3 },
    { dappId: 'beta', dappName: 'Beta Game', category: 'gaming', firstOpenedAt: '2026-09-16T11:00:00.000Z', lastOpenedAt: '2026-09-17T14:30:00.000Z', openCount: 2 },
    { dappId: 'gamma', dappName: 'Gamma Wallet', category: 'wallet', firstOpenedAt: '2026-09-13T09:00:00.000Z', lastOpenedAt: '2026-09-13T09:00:00.000Z', openCount: 1 },
  ], '2026-09-18T00:00:00.000Z');

  assert.equal(summary.weeklyExplorationCount, 6);
  assert.equal(summary.mostExplored[0].dappId, 'alpha');
  assert.equal(summary.recentlyExplored[0].dappId, 'alpha');
  assert.equal(summary.categories[0].name, 'defi');
  assert.equal(summary.newDiscoveries, 3);
  assert.match(summary.recentlyExplored[0].label, /Opened|Explored/i);
});
