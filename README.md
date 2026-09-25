# Ledger — a private budget tracker

A small, self-contained budget tracker: log in, add income/expense entries, see totals update live. No build step — it's plain HTML/CSS/JS plus Firebase, so it runs straight on GitHub Pages.

**How access is limited:** there is no sign-up form. You create each person's account yourself in the Firebase console, and only those exact accounts can sign in. Each person only sees their own entries (Firestore rules enforce this even if someone tampers with the app in their browser).

---

## 1. Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → name it (e.g. `my-budget-tracker`) → finish the wizard (you can decline Google Analytics).
2. In the left sidebar, click **Build → Authentication → Get started**.
   - Under **Sign-in method**, enable **Email/Password**.
3. In the left sidebar, click **Build → Firestore Database → Create database**.
   - Choose a location close to you, start in **production mode** (the rules file below sets the real rules).

## 2. Register a web app and get your config

1. In **Project settings** (gear icon, top left) → **Your apps** → click the **</>** (web) icon.
2. Give it a nickname, skip Firebase Hosting (you're using GitHub Pages).
3. Firebase shows a `firebaseConfig` object. Copy it into **`firebase-config.js`**, replacing the placeholder values:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "my-budget-tracker.firebaseapp.com",
  projectId: "my-budget-tracker",
  storageBucket: "my-budget-tracker.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

These values are meant to be public in client-side code — they identify your project, they don't grant access by themselves. Access is controlled by Authentication + the security rules below.

## 3. Add the Firestore security rules

1. In Firestore → **Rules** tab, replace the default rules with the contents of **`firestore.rules`** (included in this project) and click **Publish**.
2. This ensures a signed-in user can only read/write their own entries — nobody can read anyone else's data, even by guessing URLs or editing requests.

> **Want everyone to share one combined budget instead of separate personal ones?** Change the app to write to a single shared collection (e.g. `budgets/shared/entries`) instead of `users/{uid}/entries`, and change the rule to `match /budgets/shared/entries/{entryId} { allow read, write: if request.auth != null; }`. Ask me if you'd like this version built out.

## 4. Create accounts for the people who should have access

1. Authentication → **Users** tab → **Add user**.
2. Enter each person's email and a temporary password.
3. Tell them their email + temp password, and point them to "Forgot password?" on the login screen the first time so they can set their own.

To revoke someone's access later, just delete or disable their user in this same tab.

## 5. Put it on GitHub

```bash
cd budget-tracker
git init
git add .
git commit -m "Initial budget tracker"
gh repo create budget-tracker --public --source=. --push
# or: create the repo on github.com, then
# git remote add origin https://github.com/YOUR_USERNAME/budget-tracker.git
# git push -u origin main
```

## 6. Turn on GitHub Pages

1. On the repo, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**, pick `main` and `/ (root)`, save.
3. GitHub gives you a URL like `https://YOUR_USERNAME.github.io/budget-tracker/` within a minute or two.

## 7. Authorize that domain in Firebase

Firebase blocks sign-in from domains it doesn't recognize:

1. Authentication → **Settings** tab → **Authorized domains** → **Add domain**.
2. Add `YOUR_USERNAME.github.io`.

That's it — visit your GitHub Pages URL and sign in with one of the accounts you created in step 4.

---

## Notes

- **Repo visibility:** the repo (and `firebase-config.js`) can be public — the config values aren't secret. What keeps the *data* private is Authentication + the Firestore rules, not keeping the code hidden.
- **Currency:** amounts render as USD (`$`). To change it, edit `formatCurrency()` in `app.js`.
- **Editing entries:** the app currently supports add + delete; it doesn't have an edit-in-place form. Say the word if you'd like that added.
- **Local testing:** you can open `index.html` directly, but some browsers restrict `file://` scripts — easiest is `npx serve .` (or any static server) in the folder and visiting `http://localhost:3000`.
