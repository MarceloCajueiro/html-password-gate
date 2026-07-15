# html-password-gate

Put a password in front of a static HTML page — **with no backend at all.**

GitHub Pages and Cloudflare Pages have no server-side login. So instead of protecting the page *on the server*, you **encrypt the HTML on your own machine before uploading it**. Only the ciphertext goes online. When someone opens the URL, a small screen asks for a password, and the content is decrypted **entirely in the browser** using the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API). The password never touches a server.

- 🔒 **AES-256-GCM**, key derived via **PBKDF2-SHA256, 600,000 iterations** ([OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) recommendation)
- 🌐 One self-contained `index.html` — works the same on Cloudflare Pages, GitHub Pages, or any static host
- 📦 Zero dependencies — two small Node scripts using only `node:crypto`
- 🤖 Installable as a [Claude Code](https://docs.claude.com/en/docs/claude-code) skill

> 📝 Full write-up: [How to password-protect a page with no backend at all](https://cajueiro.tech/blog/) — on the Cajueiro.tech blog.

---

## Security model — read this first

This is **not** an unbreakable vault. Understand exactly what you're buying:

- **The protection is entirely the strength of the password.** Whoever downloads the page has the ciphertext *and* the code. They can brute-force the password **offline**, with no rate limit. A weak password (`123456`, a dictionary word, a name) defeats the whole thing.
- **Always use a strong, random password.** Use the included generator (`gen-password.mjs`). A 6-word random passphrase (~68 bits) paired with 600k PBKDF2 iterations makes offline cracking impractical.
- **Never commit/upload the original plaintext HTML.** Only the encrypted `index.html` goes up. If the repo is public, the ciphertext is public — that's fine, it's useless without the password. The plaintext original would be the whole leak.

The `grep` check in the steps below is there precisely to stop you from publishing the plaintext by accident.

---

## Quick start (standalone)

Requires only [Node](https://nodejs.org) (v18+). No `npm install`.

```bash
git clone https://github.com/MarceloCajueiro/html-password-gate.git
cd html-password-gate

# 1. Generate a strong password (store it in a password manager)
node gen-password.mjs
# → cedar-harbor-quartz-willow-ember-lagoon-8f2a1c9d

# 2. Encrypt your HTML into a self-contained index.html
node encrypt.mjs content.html "cedar-harbor-quartz-willow-ember-lagoon-8f2a1c9d" index.html \
  --brand "Your brand" \
  --title "Restricted access" \
  --subtitle "Enter the password to open."

# 3. Sanity check — the plaintext must NOT be in the output (expects 0)
grep -c "some-unique-snippet-of-your-content" index.html

# 4. Open it locally and confirm the password works
open index.html   # Linux: xdg-open index.html
```

Then publish `index.html` to any static host.

### Deploy to Cloudflare Pages
```bash
npx wrangler pages deploy . --project-name=my-page --branch=main --commit-dirty=true
# → https://my-page.pages.dev/
```

### Deploy to GitHub Pages
```bash
git init && git add index.html          # ONLY the encrypted file, never the original
git commit -m "publish password-protected page"
git branch -M main
git remote add origin git@github.com:<org>/<repo>.git
git push -u origin main
```
Then: **Settings → Pages → Deploy from a branch → `main` / root**. URL: `https://<org>.github.io/<repo>/`.

> Free GitHub accounts only publish from **public** repos. That's safe here — the repo holds only ciphertext.

---

## Install as a Claude Code skill

The repo doubles as a [Claude Code plugin marketplace](https://docs.claude.com/en/docs/claude-code/plugins). Install it once and just say *"publish this page with a password"* — the skill generates a strong passphrase, encrypts the HTML, and deploys it for you.

```
/plugin marketplace add MarceloCajueiro/html-password-gate
/plugin install html-password-gate@cajueiro-plugins
```

---

## The scripts

| File | What it does |
|------|--------------|
| [`gen-password.mjs`](gen-password.mjs) | Draws a random N-word passphrase + hex suffix from a CSPRNG. Defaults to 6 words. |
| [`encrypt.mjs`](encrypt.mjs) | Encrypts an HTML file (AES-256-GCM, PBKDF2 600k) and emits a self-contained `index.html` with the password screen + browser-side decryption. |

### How decryption works in the browser
When the correct password is entered, the page derives the same key, decrypts the content, and **replaces the whole document** with the original HTML — re-running its scripts and preserving the real URL (so internal `#anchors` keep working). No `innerHTML`, no `document.write`: the HTML is parsed with `DOMParser` and swapped in via `replaceChild`. Wrong password → error, nothing leaves the browser.

---

## Updating the content later

Re-run the encrypt step and re-deploy. Each encryption uses a fresh salt and IV; you can keep or rotate the password.

## License

[MIT](LICENSE) © Marcelo Cajueiro
