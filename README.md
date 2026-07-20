# html-password-gate

Put a password in front of a static HTML page — **with no backend at all.**

GitHub Pages and Cloudflare Pages have no server-side login. So instead of protecting the page *on the server*, you **encrypt the HTML on your own machine before uploading it**. Only the ciphertext goes online. When someone opens the URL, a small screen asks for a password, and the content is decrypted **entirely in the browser** using the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API). The page never sends the password anywhere.

- 🔒 **AES-256-GCM**, key derived via **PBKDF2-SHA256, 600,000 iterations** ([OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) recommendation)
- 🌐 One self-contained `index.html` — works the same on Cloudflare Pages, GitHub Pages, or any static host
- 📦 Zero dependencies — two small Node scripts using only `node:crypto` and `node:fs`
- 🔑 The password is read from the environment, never from `argv` — it stays out of `ps` and shell history
- 🤖 Installable as a [Claude Code](https://docs.claude.com/en/docs/claude-code) skill

> 📝 Full write-up: [How to password-protect a page with no backend at all](https://cajueiro.tech/blog/) — on the Cajueiro.tech blog.

---

## Security model — read this first

This is **not** an unbreakable vault. Understand exactly what you're buying:

- **The protection is entirely the strength of the password.** Whoever downloads the page has the ciphertext *and* the code. They can brute-force the password **offline**, with no rate limit. A weak password (`123456`, a dictionary word, a name) defeats the whole thing.
- **Always use a strong, random password.** Use the included generator (`gen-password.mjs`). A 6-word random passphrase (~68 bits) paired with 600k PBKDF2 iterations makes offline cracking impractical.
- **Never commit/upload the original plaintext HTML.** Only the encrypted `index.html` goes up. If the repo is public, the ciphertext is public — that's fine, it's useless without the password. The plaintext original would be the whole leak. Encrypt into a separate folder and deploy *that folder*, as the steps below do.
- **This protects against a passive host, not against a compromised one.** The page's JavaScript is served by the same host that stores the ciphertext. Whoever controls the deploy — a leaked Cloudflare/GitHub token, a repo collaborator — can serve a modified page that mails the password to them, and a visitor cannot tell. What you get is: the host does not *see* your content, and a public file stays useless without the password.
- **There is no revocation.** Anyone who opened the page keeps a permanently decryptable copy of the file. Rotating the password only protects what you publish *afterwards* — and on a public repo the old ciphertext stays in the git history.
- **Only encrypt HTML you trust.** Its scripts re-run with full access to the hosting origin. On GitHub Pages that origin (`<org>.github.io`) is shared by every repo in the org.
- **The password screen's `--title`/`--subtitle`/`--brand` are not encrypted.** Anyone who opens the URL reads them, along with the approximate size of the content.

The `grep` check in the steps below is there precisely to stop you from publishing the plaintext by accident.

---

## Quick start (standalone)

Requires only [Node](https://nodejs.org) (v18+). No `npm install`.

```bash
git clone https://github.com/MarceloCajueiro/html-password-gate.git
cd html-password-gate

# 1. Generate a strong password and keep it in the environment, not in argv
#    (an argument would be visible in `ps` and saved to your shell history).
export GATE_PASSWORD=$(node gen-password.mjs)
echo "$GATE_PASSWORD"   # → cedar-harbor-quartz-…-8f2a1c9d — save it in a password manager

# 2. Encrypt into a deploy folder that holds NOTHING but the encrypted page
mkdir -p dist
node encrypt.mjs content.html dist/index.html \
  --brand "Your brand" \
  --title "Restricted access" \
  --subtitle "Enter the password to open."

# 3. Sanity check — the plaintext must NOT be in the output
! grep -q "some-unique-snippet-of-your-content" dist/index.html && echo "clean"

# 4. Open it locally and confirm the password works
open dist/index.html   # Linux: xdg-open dist/index.html
```

**Deploy the folder, never the working directory** — `dist/` holds only the encrypted
page, while the directory you worked in still has `content.html` in the clear.

### Deploy to Cloudflare Pages
```bash
npx wrangler pages project create my-page --production-branch=main   # first time only
npx wrangler pages deploy dist --project-name=my-page --branch=main --commit-dirty=true
# → https://my-page.pages.dev/
```

### Deploy to GitHub Pages
```bash
cd dist                                 # a fresh repo, holding only the encrypted page
git init && git add index.html
git commit -m "publish password-protected page"
git branch -M main
git remote add origin git@github.com:<org>/<repo>.git
git push -u origin main
```
Then: **Settings → Pages → Deploy from a branch → `main` / root**. URL: `https://<org>.github.io/<repo>/`.

> Free GitHub accounts only publish from **public** repos. That's safe here — the repo holds only ciphertext.

---

## Install as a Claude Code skill

The repo ships a [Claude Code plugin](https://docs.claude.com/en/docs/claude-code/plugins). Install it once and just say *"publish this page with a password"* — the skill generates a strong passphrase, encrypts the HTML, and deploys it for you.

```
/plugin marketplace add MarceloCajueiro/claude-plugins
/plugin install html-password-gate@cajueiro-plugins
```

---

## The scripts

| File | What it does |
|------|--------------|
| [`gen-password.mjs`](gen-password.mjs) | Draws a random 6-word passphrase + hex suffix from a CSPRNG (~68 bits). |
| [`encrypt.mjs`](encrypt.mjs) | Encrypts an HTML file (AES-256-GCM, PBKDF2 600k) and emits a self-contained `index.html` with the password screen + browser-side decryption. Reads the password from `GATE_PASSWORD`. |

The page needs a **secure context** to decrypt: HTTPS, `localhost`, or a local file.
Cloudflare Pages and GitHub Pages are HTTPS by default; a plain `http://` host on a LAN
is not, and the page says so instead of claiming the password is wrong.

### How decryption works in the browser
When the correct password is entered, the page derives the same key, decrypts the content, and **replaces the whole document** with the original HTML — re-running its scripts and preserving the real URL (so internal `#anchors` keep working). No `innerHTML`, no `document.write`: the HTML is parsed with `DOMParser` and swapped in via `replaceChild`. Wrong password → error, nothing leaves the browser.

---

## Updating the content later

Re-run the encrypt step and re-deploy. Each encryption uses a fresh salt and IV; you can keep or rotate the password.

## License

[MIT](LICENSE) © Marcelo Cajueiro
