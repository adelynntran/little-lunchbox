# Little Lunchbox

A cozy personal weekly menu and grocery list maker. Little Lunchbox combines
reusable dishes into compatible meals, plans leftovers, and builds one shopping
list for the week.

## Trial site:
https://little-lunchbox.adelynn-tr.workers.dev/

## What it does

- Plans breakfast, lunch, and dinner for one person
- Mixes compatible mains, bases, and sides using pairing families
- Reuses cooked dishes within the next few days
- Regenerates the whole week or one individual meal
- Stores reusable dish cards in a searchable Kitchen
- Combines ingredient quantities and subtracts pantry items
- Saves dishes, plans, and pantry choices in the browser

## Run locally

You need Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal. To verify a production build:

```bash
npm run build
npm test
```

## Data

This version is designed for personal use. Its data is stored in browser local
storage, so no account or external database is required.

## Stack

React 19, TypeScript, vinext, Vite, and Cloudflare Workers-compatible output.
