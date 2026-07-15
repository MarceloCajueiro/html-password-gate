---
name: html-password-gate
description: Publish a password-protected static HTML page with no backend. The HTML is encrypted (AES-256-GCM, key via PBKDF2) BEFORE upload — only the ciphertext reaches the server, the password is typed and decrypted 100% in the browser. Use when the user wants to host a report/guide/artifact HTML behind a password, "upload it encrypted", put a password gate in front of a page without a backend, or deploy a private HTML to Cloudflare Pages or GitHub Pages.
user_invocable: true
---

# HTML Password Gate — password-protected HTML on static hosting

Turns any HTML file into a password-protected static page and publishes it to Cloudflare Pages or GitHub Pages. No backend.

## How it works (security model)

- The HTML is **encrypted with AES-256-GCM before upload**. The host only ever stores base64 ciphertext — the content never goes up in plaintext.
- The key is derived from the password via **PBKDF2-SHA256, 600,000 iterations** (OWASP recommendation). There is no key hidden in the code — you cannot reverse-engineer the content out without the password.
- The password is typed on the access screen and decryption runs **entirely in the browser** (Web Crypto API). The password **never travels** to any server.

> ⚠️ **Security is entirely the strength of the password.** Since the attacker gets the ciphertext + the decryption code, they can brute-force it *offline* (no rate limit). This skill **generates a long, random passphrase by default**. Never swap it for something short or guessable — that defeats the protection.

## Prerequisites

- `node` (uses only native APIs: `node:crypto`, `node:fs`) — no npm install.
- For Cloudflare deploy: `wrangler` authenticated (`npx wrangler whoami`).
- For GitHub Pages deploy: `git` + a GitHub repo.

Scripts live at the plugin root. Reference them with `${CLAUDE_PLUGIN_ROOT}`.

## Steps

### 1. Get the input HTML
The user provides a path to a ready `.html`. If they want you to **create** the artifact, do that first, then encrypt.

### 2. Set the password
**By default, generate a strong one:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/gen-password.mjs
```
Only use a user-supplied password if they insist — and if so, **warn** when it's weak (short, dictionary word, predictable).

### 3. Encrypt and generate the `index.html`
Create a deploy folder with a **single `index.html`** (the host serves the root):
```bash
mkdir -p <deploy-dir>
node ${CLAUDE_PLUGIN_ROOT}/encrypt.mjs \
  <input.html> "<password>" <deploy-dir>/index.html \
  --brand "Your brand" \
  --title "Restricted access" \
  --subtitle "Short line explaining what this is and who the password is for."
```
The `--brand`, `--title`, `--subtitle` flags customize the password screen (all optional; generic defaults). Text is auto-escaped.

### 4. Validate locally (before uploading)
Confirm the right password decrypts and the wrong one fails. Open the file (`open <deploy-dir>/index.html`) and test, or drive it with a headless browser if available. Minimum check: the `index.html` **does not contain** the original content in plaintext — `grep` for a unique snippet of the input HTML must return 0:
```bash
grep -c "<unique-snippet-of-original>" <deploy-dir>/index.html   # must be 0
```

### 5a. Deploy to Cloudflare Pages
```bash
npx wrangler whoami   # pick the right account if there are several
# create the project (first time only):
CLOUDFLARE_ACCOUNT_ID=<account_id> npx wrangler pages project create <project> --production-branch=main
# deploy:
cd <deploy-dir> && CLOUDFLARE_ACCOUNT_ID=<account_id> \
  npx wrangler pages deploy . --project-name=<project> --branch=main --commit-dirty=true
```
Result: `https://<project>.pages.dev/`.

### 5b. Deploy to GitHub Pages
Put **only the encrypted `index.html`** in the repo root. **Never commit the original.**
```bash
cd <deploy-dir> && git init && git add index.html
git commit -m "publish password-protected page"
git branch -M main
git remote add origin git@github.com:<org>/<repo>.git
git push -u origin main
```
Then: **Settings → Pages → Deploy from a branch → `main` / root**. URL: `https://<org>.github.io/<repo>/`.
> Free accounts only publish from **public** repos — safe here, since the repo holds only ciphertext.

### 6. Validate live
```bash
curl -s -o /dev/null -w "%{http_code}\n" <url>        # 200
curl -s <url> | grep -c "<unique-snippet-of-original>" # must be 0
```

### 7. Deliver
Give the user the **URL** and the **password**. Ask whether the password should be shared alongside the link or kept on a separate channel.

## Maintenance notes

- **Re-deploy after editing content:** repeat steps 3 and 5. Each `encrypt.mjs` run generates a fresh salt/iv (and can use a new password).
- **Cleanup:** if the source HTML / deploy folder are temporary, keep them in `/tmp` and remove them at the end.

## Fixed decisions of this skill (unless the user asks otherwise)
- Strong password generated automatically.
- Single self-contained `index.html`.
- Deploy target chosen by the user (Cloudflare Pages or GitHub Pages).
