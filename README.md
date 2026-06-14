# Maths Stars ⭐ — Mental Arithmetic Practice

A simple, friendly web app for practising mental arithmetic. Works the same on a laptop, iPhone, or iPad. White background, big buttons, an on-screen number pad, and a star/score reward at the end. Every session is quietly timed and saved with the date so you can track progress over time.

The UI markup lives in **`index.html`**; the JavaScript is split into small ES modules under **`src/`** (`src/app.js` for the UI, `src/logic/*` for pure logic). There is still **no build step** — the browser loads the modules natively.

> **Heads-up:** because it now uses ES modules, opening `index.html` by double-clicking (`file://`) no longer works — browsers block module loading over `file://`. Run it through a local server instead (see *Development* below). The live site on GitHub Pages is unaffected.

---

## What it does

- **9 practice levels**
  1. Addition — numbers under 10
  2. Addition — numbers under 20
  3. Subtraction — numbers under 10 (answers never go below zero)
  4. Subtraction — numbers under 20 (answers never go below zero)
  5. Multiplication — up to 12
  6. Division — up to 12 (always whole-number answers)
  7. Mixed: addition & subtraction (levels 2 & 4)
  8. Mixed: multiplication & division (levels 5 & 6)
  9. Mixed: all of the above (levels 2, 4, 5 & 6)
- **Tunable session length** — 5 to 50 questions, in steps of 5 (default 10). Set it with the −/+ buttons on the home screen.
- **Hidden timer** — the clock is never shown during a session (no pressure), but total time, time-per-question, score, answers, and the date are all saved.
- **History & progress** — tap **📊 History** to see past sessions, filter by level, and view accuracy and speed trends.
- **Family & players** — everyone shares a **family name**, and each person has their own **player name** within it. On first use you enter the family name, then your player name. Tap the **👪 / 👤** label at the top right to switch player or change family. Scores are kept per player but the whole family can see each other's history.
- **Stars & rewards** ⭐ — every session earns stars: a base amount for finishing (more for longer sessions), bonuses for accuracy, speed, beating your personal best, trying a new level, and harder levels. Practising on consecutive days builds a **daily streak** 🔥 with milestone bonuses. Your running total fills a **night sky** on the home screen that levels up through collectible tiers (Stargazer → Comet → …). Rewards are personal — each player races their own best, not a family leaderboard.

---

## Getting started

The app is hosted on **GitHub Pages** — just open the site URL on any device. Scores are saved on that device/browser unless you turn on cloud sync (below).

To run it locally, see *Development* below (a one-line static server — double-clicking the file won't work now that it uses ES modules).

To use it on the iPhone and iPad too, and to have all scores in one place, set up free cloud sync below.

---

## Development

No build step and no dependencies to install. You just need [Node.js](https://nodejs.org) (for the tests) and any static file server.

```bash
# Run locally (serves the folder at http://localhost:3000)
npm run serve        # → npx serve . -l 3000

# Run the tests (pure-logic unit tests, no browser needed)
npm test             # → node --test on tests/*.test.js
```

Layout:
- `index.html` — markup and styles
- `src/app.js` — UI wiring, storage, Firebase (the side-effecty shell)
- `src/logic/` — pure logic: `questions.js`, `schema.js`, `storage-keys.js`, `stats.js`, `rewards.js`
- `tests/` — unit tests for the logic modules

---

## Cloud sync across devices (free, ~5 minutes)

This uses **Firebase** (Google's free tier). You create a tiny database, copy a short config, and paste it into the app. No coding.

### 1. Create the project
1. Go to <https://console.firebase.google.com> and sign in with a Google account.
2. Click **Add project**, give it any name (e.g. *maths-stars*), and accept the defaults. You can disable Google Analytics — it's not needed.

### 2. Create the database
1. In the left menu choose **Build → Firestore Database**.
2. Click **Create database**.
3. Choose a location near you, and start in **Test mode** (fine for family use). Click **Enable**.

### 3. Get your config
1. Click the **⚙️ gear → Project settings**.
2. Scroll to **Your apps**, click the web icon **`</>`**.
3. Give it a nickname, click **Register app**.
4. You'll see a block like this — copy just the `{ ... }` object:

```js
const firebaseConfig = {
  apiKey: "AIza............",
  authDomain: "maths-stars.firebaseapp.com",
  projectId: "maths-stars",
  storageBucket: "maths-stars.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:1234:web:abcd"
};
```

### 4. Paste it into the app
1. Open the app, tap **👤** (top right) → **☁️ Cloud sync settings**.
2. Paste the `{ ... }` config into the box and tap **Save & connect**.
3. The tag at the top should change to **☁️ Synced**.

Do this once on each device (laptop, iPhone, iPad) using the **same** config, and enter the **same family name** on each. Each person picks their own **player name** within the family, and everyone in the family can see each other's scores. Scores will then appear everywhere.

> **Note on the database rule:** Test mode leaves the database open for 30 days. For a low-stakes family arithmetic app that's usually fine, but if you'd like, I can give you a one-line security rule to lock it down — just ask.

---

## Putting it online (so phones/tablets can open it)

Phones and tablets need a web address to open the app. Pick whichever is easiest:

**Easiest — Netlify Drop (no account needed to try):**
1. Go to <https://app.netlify.com/drop>.
2. Drag the **whole folder** (the one containing `index.html`) onto the page.
3. You get a link like `https://something.netlify.app` — open that on every device. Bookmark it / add to Home Screen.

**Alternative — Firebase Hosting** (if you've already set up Firebase): it's free but uses a command-line tool; ask me and I'll walk you through it.

**On iPhone/iPad:** open the link in Safari, tap the **Share** button, then **Add to Home Screen** — it then behaves like a real app icon.

---

## Tips
- The app remembers the player name, question count, and sync settings on each device automatically.
- If you ever want to start fresh on a device, clearing the browser's site data for the app resets it. Cloud-synced scores stay safe in Firebase.
- No accounts, no ads, no tracking — it's just a single HTML file.

Have fun! 🌟
