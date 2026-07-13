# Bearzenker.com

Static site for **bearzenker.com**, hosted on GitHub Pages.

## Local preview

Just open `index.html` in a browser. No build step — it is plain HTML + CSS with Google Fonts loaded by CDN.

## Deploy to GitHub Pages

This repo is named `bearzenker.github.io`, which is GitHub's convention for a user/organization Pages site: the default branch is served at the root, with no build step.

- All site files live at the repo root (`index.html`, `images/`, etc.)
- `.nojekyll` disables GitHub's default Jekyll processing so plain static files are served as-is
- `CNAME` binds the site to the custom domain `bearzenker.com`
- On every push to the default branch, GitHub publishes the root of the branch

In **Settings → Pages**, confirm:

- **Source:** Deploy from a branch
- **Branch:** `main` (or whatever the default is) / folder `/ (root)`

To wire the custom domain (`bearzenker.com`):

1. **Settings → Pages → Custom domain**, enter `bearzenker.com` (this also writes the `CNAME` file if it isn't already committed)
2. Configure DNS at your registrar:
   - Apex `bearzenker.com`: four `A` records to GitHub's Pages IPs
     - `185.199.108.153`
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`
   - `www.bearzenker.com`: `CNAME` record to `bearzenker.github.io`
3. Once DNS propagates and GitHub provisions the Let's Encrypt cert, enable **Enforce HTTPS**

## Structure

```
.
├── .nojekyll              # disable Jekyll; serve files as-is
├── CNAME                  # custom domain binding
├── README.md
├── index.html             # the whole site
├── tweaks-app.jsx
├── tweaks-panel.jsx
└── images/
    └── bearzenker-bear.png
```

If you want to keep the bear and any future imagery out of git LFS, leave PNGs under ~1 MB. The current hero image is well under that.

## Editorial notes

The site is intentionally one page. Sections are numbered (01–04) so the URL anchors are stable and the order can be reasoned about. Copy is direct and avoids marketing register. Forest green (`#1f4030`) is reserved for the wordmark, headings, links, and the stance band; everything else is warm paper + near-black.
