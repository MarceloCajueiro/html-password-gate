#!/usr/bin/env node
// Generates a strong, random passphrase: N distinct words + a hex suffix.
// Words are drawn from a CSPRNG (node:crypto), not Math.random.
//
// Usage:
//   node gen-password.mjs            # 6 words (default)
//   node gen-password.mjs 5          # custom word count
//
// Entropy: with the 68-word list below, each distinct word adds ~6.1 bits and the
// 4-byte hex suffix adds 32 bits. Defaults (6 words) ≈ 68 bits — plenty when paired
// with the 600k-iteration PBKDF2 key derivation used by encrypt.mjs. Store it in a
// password manager; you don't need to memorize it.

import { webcrypto as crypto } from 'node:crypto';

const words = ('anchor amber aspen basin beacon birch bison bloom canyon cedar cliff clover ' +
  'cobalt comet copper coral cove delta dune ember fable falcon fern fjord ' +
  'flint glade granite harbor heron hollow indigo ivory jade juniper kelp lagoon ' +
  'lantern maple marsh meadow mesa nectar oasis orchard otter pebble pine quartz ' +
  'quill raven reef ridge river saffron sage slate spruce summit thicket tundra ' +
  'umber valley vertex willow wren yonder zenith zephyr').split(' ');

const count = Math.max(2, parseInt(process.argv[2], 10) || 6);
if (count > words.length) {
  console.error(`Word count ${count} exceeds the ${words.length}-word list.`);
  process.exit(1);
}

function pick(arr) {
  const idx = crypto.getRandomValues(new Uint32Array(1))[0] % arr.length;
  return arr[idx];
}

const chosen = [];
while (chosen.length < count) {
  const w = pick(words);
  if (!chosen.includes(w)) chosen.push(w);
}
const suffix = Buffer.from(crypto.getRandomValues(new Uint8Array(4))).toString('hex');
console.log(chosen.join('-') + '-' + suffix);
