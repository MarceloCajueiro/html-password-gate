#!/usr/bin/env node
// Generates a strong, random passphrase: 6 distinct words + a hex suffix.
// Words are drawn from a CSPRNG (node:crypto), not Math.random.
//
// Usage:
//   node gen-password.mjs
//   export GATE_PASSWORD=$(node gen-password.mjs)   # what encrypt.mjs reads
//
// Entropy: 6 distinct words drawn in order from the 68-word list below is
// log2(68×67×66×65×64×63) ≈ 36 bits, and the 4-byte hex suffix adds 32 — about
// 68 bits total, which is what makes offline brute-force impractical against the
// 600k-iteration PBKDF2 in encrypt.mjs. Store it in a password manager; you don't
// need to memorize it.

import { randomInt, webcrypto as crypto } from 'node:crypto';

const words = ('anchor amber aspen basin beacon birch bison bloom canyon cedar cliff clover ' +
  'cobalt comet copper coral cove delta dune ember fable falcon fern fjord ' +
  'flint glade granite harbor heron hollow indigo ivory jade juniper kelp lagoon ' +
  'lantern maple marsh meadow mesa nectar oasis orchard otter pebble pine quartz ' +
  'quill raven reef ridge river saffron sage slate spruce summit thicket tundra ' +
  'umber valley vertex willow wren yonder zenith zephyr').split(' ');

// Fixed at 6: the password is the entire security of the generated page, so this
// is not a knob worth exposing — a shorter one just makes a weaker page.
const COUNT = 6;

const chosen = [];
while (chosen.length < COUNT) {
  const w = words[randomInt(words.length)]; // randomInt is unbiased, unlike % length
  if (!chosen.includes(w)) chosen.push(w);
}
const suffix = Buffer.from(crypto.getRandomValues(new Uint8Array(4))).toString('hex');
console.log(chosen.join('-') + '-' + suffix);
