# Maths Stars ⭐ — Mental Arithmetic Practice

A simple, friendly web app for practising mental arithmetic. Works the same on a laptop, iPhone, or iPad. White background, big buttons, an on-screen number pad, and a star/score reward at the end. Every session is quietly timed and saved with the date so you can track progress over time.

Everything lives in one file: **`index.html`**. There is no build step.

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
- **Separate players** — tap the **👤** name at the top right to switch player, so each child's scores are kept apart.

---

## Getting started (try it in 10 seconds)

Just double-click **`index.html`** — it opens in your browser and works immediately. At this stage, scores are saved **only on that one device/browser**.

To use it on the iPhone and iPad too, and to have all scores in one place, set up free cloud sync and hosting below.

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

Do this once on each device (laptop, iPhone, iPad) using the **same** config, and use the **same player name** on each. Scores will then appear everywhere.

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
