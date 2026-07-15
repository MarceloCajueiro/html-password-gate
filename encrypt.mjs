#!/usr/bin/env node
// Encrypts an HTML file with AES-256-GCM (key derived via PBKDF2-SHA256,
// 600k iterations — OWASP recommendation) and emits a self-contained
// index.html with a password screen + decryption that runs 100% in the browser.
//
// Usage:
//   node encrypt.mjs <input.html> <password> <output.html> [--title "..."] [--subtitle "..."] [--brand "..."]
//
// The hosting server only ever receives the ciphertext; the password never travels.
// Security is entirely the strength of the password (offline brute-force is possible
// because the attacker holds the ciphertext + the code). Always use a long, random passphrase.

import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';

function parseArgs(argv) {
  const positional = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--title') opts.title = argv[++i];
    else if (a === '--subtitle') opts.subtitle = argv[++i];
    else if (a === '--brand') opts.brand = argv[++i];
    else positional.push(a);
  }
  return { positional, opts };
}

const { positional, opts } = parseArgs(process.argv.slice(2));
const [inputPath, password, outputPath] = positional;

if (!inputPath || !password || !outputPath) {
  console.error('Usage: node encrypt.mjs <input.html> <password> <output.html> [--title "..."] [--subtitle "..."] [--brand "..."]');
  process.exit(1);
}

const TITLE = opts.title || 'Restricted access';
const SUBTITLE = opts.subtitle || 'This content is encrypted. Enter the password to open it.';
const BRAND = opts.brand || 'Protected content';
const ITERATIONS = 600_000;

const enc = new TextEncoder();
const plaintext = readFileSync(inputPath);

const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));

const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
  baseKey,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt']
);

const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));

const b64 = (u8) => Buffer.from(u8).toString('base64');
const payload = { v: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), ct: b64(ciphertext) };

// Escape for safe use inside HTML text (title/subtitle come from args).
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const shell = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${esc(TITLE)}</title>
<style>
  :root { --brand-800:#3330a4; --brand-700:#0052f5; --brand-500:#03bdf7; --neutral-500:#737373; --neutral-700:#404040; --neutral-900:#171717; --border:#e5e5e5; --error:#b91c1c; --error-bg:#fef2f2; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:system-ui,-apple-system,"Segoe UI",sans-serif; background:var(--brand-800); min-height:100vh; display:flex; align-items:center; justify-content:center; padding:1.5rem; }
  .gate { background:#fff; border-radius:1rem; box-shadow:0 20px 60px rgba(0,0,0,.3); padding:2.25rem 2rem; width:100%; max-width:420px; }
  .brand { display:flex; align-items:center; gap:.6rem; font-weight:800; font-size:1.05rem; color:var(--neutral-900); letter-spacing:-.01em; margin-bottom:.35rem; }
  .dot { width:12px; height:12px; border-radius:9999px; background:var(--brand-500); box-shadow:0 0 0 4px rgba(3,189,247,.25); }
  h1 { font-size:1.35rem; font-weight:800; color:var(--neutral-900); letter-spacing:-.02em; margin:1rem 0 .35rem; }
  p.sub { font-size:.9rem; color:var(--neutral-500); margin-bottom:1.5rem; line-height:1.5; }
  label { display:block; font-size:.8rem; font-weight:700; color:var(--neutral-700); margin-bottom:.4rem; }
  .field { display:flex; gap:.5rem; }
  input { flex:1; font-family:ui-monospace,"SF Mono","JetBrains Mono",monospace; font-size:.95rem; padding:.7rem .85rem; border:1px solid var(--border); border-radius:.5rem; color:var(--neutral-900); outline:none; transition:border-color .15s, box-shadow .15s; }
  input:focus { border-color:var(--brand-700); box-shadow:0 0 0 3px rgba(0,82,245,.12); }
  button { font-family:inherit; font-size:.95rem; font-weight:700; padding:.7rem 1.1rem; border:none; border-radius:.5rem; background:var(--brand-700); color:#fff; cursor:pointer; transition:background .15s, opacity .15s; }
  button:hover { background:#0040c4; }
  button:disabled { opacity:.6; cursor:wait; }
  .err { display:none; margin-top:.85rem; font-size:.85rem; color:var(--error); background:var(--error-bg); border:1px solid #fecaca; border-radius:.5rem; padding:.6rem .8rem; }
  .err.show { display:block; }
  .hint { margin-top:1.25rem; font-size:.75rem; color:#a3a3a3; line-height:1.5; }
</style>
</head>
<body>
  <form class="gate" id="gate" autocomplete="off">
    <div class="brand"><span class="dot"></span> ${esc(BRAND)}</div>
    <h1>${esc(TITLE)}</h1>
    <p class="sub">${esc(SUBTITLE)}</p>
    <label for="pw">Password</label>
    <div class="field">
      <input type="password" id="pw" placeholder="••••••••••••" autofocus>
      <button type="submit" id="go">Open</button>
    </div>
    <div class="err" id="err"></div>
    <p class="hint">The password is never sent to any server — decryption happens entirely in your browser (AES-256-GCM, PBKDF2 ${ITERATIONS.toLocaleString('en-US')} iterations).</p>
  </form>

<script id="payload" type="application/json">${JSON.stringify(payload)}</script>
<script>
(function () {
  var P = JSON.parse(document.getElementById('payload').textContent);
  var form = document.getElementById('gate');
  var pw = document.getElementById('pw');
  var go = document.getElementById('go');
  var err = document.getElementById('err');

  function b64ToBytes(b64) {
    var bin = atob(b64);
    var u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  function showError(msg) {
    err.textContent = msg;
    err.classList.add('show');
    go.disabled = false;
    go.textContent = 'Open';
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    err.classList.remove('show');
    go.disabled = true;
    go.textContent = 'Opening…';
    try {
      var enc = new TextEncoder();
      var baseKey = await crypto.subtle.importKey('raw', enc.encode(pw.value), 'PBKDF2', false, ['deriveKey']);
      var key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: b64ToBytes(P.salt), iterations: P.iterations, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      var plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64ToBytes(P.iv) },
        key,
        b64ToBytes(P.ct)
      );
      var html = new TextDecoder().decode(plainBuf);
      // Replace the current document with the decrypted content while keeping the
      // page's real URL. That is what makes internal anchors (#section) work — an
      // iframe srcdoc (about:srcdoc) or a Blob URL (blob:) would treat an anchor
      // click as navigation and lose the page.
      // No document.write and no innerHTML: the HTML is parsed with DOMParser and
      // the resulting <html> is adopted and swapped in via replaceChild.
      var newDoc = new DOMParser().parseFromString(html, 'text/html');
      var newRoot = document.importNode(newDoc.documentElement, true);
      document.replaceChild(newRoot, document.documentElement);
      // Re-run the content's <script> tags (scripts inserted by parsing/cloning
      // do not execute on their own).
      var scripts = document.querySelectorAll('script');
      for (var i = 0; i < scripts.length; i++) {
        var old = scripts[i];
        var s = document.createElement('script');
        if (old.src) { s.src = old.src; } else { s.textContent = old.textContent; }
        old.parentNode.replaceChild(s, old);
      }
      // If the URL already carried a hash, scroll to the target after the swap.
      if (location.hash) {
        var target = document.getElementById(location.hash.slice(1));
        if (target) target.scrollIntoView();
      }
    } catch (ex) {
      showError('Incorrect password. Try again.');
      pw.value = '';
      pw.focus();
    }
  });
})();
</script>
</body>
</html>`;

writeFileSync(outputPath, shell);
console.log('OK — ' + outputPath);
console.log('  plaintext:  ' + plaintext.length + ' bytes');
console.log('  ciphertext: ' + payload.ct.length + ' chars (base64)');
console.log('  output:     ' + Buffer.byteLength(shell) + ' bytes');
