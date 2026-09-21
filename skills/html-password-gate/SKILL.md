---
name: html-password-gate
description: Password-protect an HTML file and publish it — a link only people with the password can open, with no backend and no login system. Use when the user wants to share a report/guide/artifact privately, "send this only to them", "a link that needs a password", host a page behind a password, "upload it encrypted", put a password gate in front of a page, or deploy a private HTML to Cloudflare Pages or GitHub Pages. Works by encrypting the HTML (AES-256-GCM, key via PBKDF2) before upload — only ciphertext reaches the server and decryption happens 100% in the browser.
user_invocable: true
---

# HTML Password Gate — password-protected HTML on static hosting

Turns any HTML file into a password-protected static page and publishes it to Cloudflare Pages or GitHub Pages. No backend.

## How it works (security model)

- The HTML is **encrypted with AES-256-GCM before upload**. The host only ever stores base64 ciphertext — the content never goes up in plaintext.
- The key is derived from the password via **PBKDF2-SHA256, 600,000 iterations** (OWASP recommendation). There is no key hidden in the code — you cannot reverse-engineer the content out without the password.
- The password is typed on the access screen and decryption runs **entirely in the browser** (Web Crypto API). The page **never sends** the password anywhere.
- Decryption needs a **secure context**: HTTPS, `localhost`, or a local file. Both documented hosts are HTTPS; a plain `http://` LAN host cannot decrypt (the page says so).

> ⚠️ **Security is entirely the strength of the password.** Since the attacker gets the ciphertext + the decryption code, they can brute-force it *offline* (no rate limit). This skill **generates a long, random passphrase by default**. Never swap it for something short or guessable — that defeats the protection.

Tell the user, when it matters, what this does **not** cover: whoever controls the deploy
account could serve a page that steals the password; there is no revocation (anyone who
opened it keeps a decryptable copy); and the title/subtitle/brand on the gate are public.

## Prerequisites

- `node` (uses only native APIs: `node:crypto`, `node:fs`) — no npm install.
- For Cloudflare deploy: `wrangler` authenticated (`npx wrangler whoami`).
- For GitHub Pages deploy: `git` + a GitHub repo.

Scripts ship inside this skill, next to this file. Run them with the path of the directory this SKILL.md was loaded from - that path is already known and always correct.

## Steps

### 1. Get the input HTML
The user provides a path to a ready `.html`. If they want you to **create** the artifact, do that first, then encrypt.

### 2. Set the password
**By default, generate a strong one** — and pass it to the next step through the
environment, so it never lands in `ps`, in the shell history, or in this session's log:
```bash
export GATE_PASSWORD=$(node "$SKILL_DIR/gen-password.mjs")
```
Read it back with `echo "$GATE_PASSWORD"` only at the end, when you hand it to the user.
Only use a user-supplied password if they insist — and if so, **warn** when it's weak (short, dictionary word, predictable).

### 3. Encrypt and generate the `index.html`
Create a deploy folder with a **single `index.html`** (the host serves the root):
```bash
mkdir -p <deploy-dir>
node "$SKILL_DIR/encrypt.mjs" \
  <input.html> <deploy-dir>/index.html \
  --brand "Your brand" \
  --title "Restricted access" \
  --subtitle "Short line explaining what this is and who the password is for."
```
The password comes from `GATE_PASSWORD` (set in the previous step), never as an argument.
The `--brand`, `--title`, `--subtitle` flags customize the password screen (all optional; generic defaults). Text is auto-escaped — and **not encrypted**, so keep anything confidential out of them.

The deploy folder must hold **only** `index.html`: deploying the working directory would
upload the plaintext input alongside it, which is the one leak that breaks everything.

### 4. Validate locally (before uploading)
Confirm the right password decrypts and the wrong one fails. Open the file (`open <deploy-dir>/index.html`) and test, or drive it with a headless browser if available. Minimum check: the `index.html` **does not contain** the original content in plaintext — `grep` for a unique snippet of the input HTML must return 0:
```bash
! grep -q "<unique-snippet-of-original>" <deploy-dir>/index.html && echo "clean"
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
curl -s <url> | grep -q "<unique-snippet-of-original>" || echo "clean"
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
