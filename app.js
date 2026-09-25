// ===== Firebase handles =====
const auth = firebase.auth();
const db = firebase.firestore();

// ===== DOM refs =====
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');
const resetLink = document.getElementById('reset-link');
const logoutBtn = document.getElementById('logout-btn');
const userEmailEl = document.getElementById('user-email');

const entryForm = document.getElementById('entry-form');
const entryDesc = document.getElementById('entry-desc');
const entryAmount = document.getElementById('entry-amount');
const entryType = document.getElementById('entry-type');
const entryCategory = document.getElementById('entry-category');
const entryDate = document.getElementById('entry-date');
const entrySubmit = document.getElementById('entry-submit');

const ledgerBody = document.getElementById('ledger-body');
const ledgerTable = document.getElementById('ledger-table');
const ledgerEmpty = document.getElementById('ledger-empty');
const entryCount = document.getElementById('entry-count');

const sumIncome = document.getElementById('sum-income');
const sumExpense = document.getElementById('sum-expense');
const sumBalance = document.getElementById('sum-balance');

const toast = document.getElementById('toast');

let unsubscribeEntries = null;

// Default the date field to today
entryDate.value = new Date().toISOString().slice(0, 10);

// ===== Auth state =====
auth.onAuthStateChanged((user) => {
  if (user) {
    loginScreen.hidden = true;
    appScreen.hidden = false;
    userEmailEl.textContent = user.email;
    listenToEntries(user.uid);
  } else {
    appScreen.hidden = true;
    loginScreen.hidden = false;
    if (unsubscribeEntries) { unsubscribeEntries(); unsubscribeEntries = null; }
    ledgerBody.innerHTML = '';
  }
});

// ===== Login =====
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in…';
  try {
    await auth.signInWithEmailAndPassword(loginEmail.value.trim(), loginPassword.value);
  } catch (err) {
    loginError.textContent = friendlyAuthError(err);
    loginError.hidden = false;
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign in';
  }
});

resetLink.addEventListener('click', async () => {
  const email = loginEmail.value.trim();
  if (!email) {
    loginError.textContent = 'Enter your email above first, then tap "Forgot password?"';
    loginError.hidden = false;
    return;
  }
  try {
    await auth.sendPasswordResetEmail(email);
    showToast('Password reset email sent.');
  } catch (err) {
    loginError.textContent = friendlyAuthError(err);
    loginError.hidden = false;
  }
});

logoutBtn.addEventListener('click', () => auth.signOut());

function friendlyAuthError(err) {
  const map = {
    'auth/invalid-email': 'That email address looks invalid.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found for that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
  };
  return map[err.code] || 'Something went wrong signing in. Please try again.';
}

// ===== Entries: Firestore (scoped per-user at users/{uid}/entries) =====
function listenToEntries(uid) {
  if (unsubscribeEntries) unsubscribeEntries();
  unsubscribeEntries = db
    .collection('users').doc(uid).collection('entries')
    .orderBy('date', 'desc')
    .onSnapshot(
      (snapshot) => {
        const entries = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        renderEntries(entries);
      },
      (err) => {
        console.error(err);
        showToast('Could not load entries. Check your Firestore rules.', true);
      }
    );
}

entryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const amountRaw = parseFloat(entryAmount.value);
  if (isNaN(amountRaw) || amountRaw <= 0) {
    showToast('Enter an amount greater than zero.', true);
    return;
  }

  entrySubmit.disabled = true;
  try {
    await db.collection('users').doc(user.uid).collection('entries').add({
      description: entryDesc.value.trim() || '(no description)',
      amount: amountRaw,
      type: entryType.value,
      category: entryCategory.value,
      date: entryDate.value,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    entryForm.reset();
    entryDate.value = new Date().toISOString().slice(0, 10);
    entryDesc.focus();
  } catch (err) {
    console.error(err);
    showToast('Could not save entry. Check your Firestore rules.', true);
  } finally {
    entrySubmit.disabled = false;
  }
});

async function deleteEntry(id) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await db.collection('users').doc(user.uid).collection('entries').doc(id).delete();
  } catch (err) {
    console.error(err);
    showToast('Could not delete entry.', true);
  }
}

// ===== Rendering =====
function renderEntries(entries) {
  ledgerBody.innerHTML = '';

  if (entries.length === 0) {
    ledgerTable.hidden = true;
    ledgerEmpty.hidden = false;
    entryCount.textContent = '';
  } else {
    ledgerTable.hidden = false;
    ledgerEmpty.hidden = true;
    entryCount.textContent = entries.length + (entries.length === 1 ? ' entry' : ' entries');
  }

  let income = 0, expense = 0;

  entries.forEach((entry) => {
    if (entry.type === 'income') income += entry.amount;
    else expense += entry.amount;

    const tr = document.createElement('tr');

    const dateTd = document.createElement('td');
    dateTd.textContent = formatDate(entry.date);
    tr.appendChild(dateTd);

    const descTd = document.createElement('td');
    descTd.textContent = entry.description;
    tr.appendChild(descTd);

    const catTd = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = 'category-pill';
    pill.textContent = entry.category;
    catTd.appendChild(pill);
    tr.appendChild(catTd);

    const amountTd = document.createElement('td');
    amountTd.className = 'amount-cell ' + entry.type;
    amountTd.textContent = (entry.type === 'income' ? '+' : '−') + formatCurrency(entry.amount);
    tr.appendChild(amountTd);

    const actionsTd = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.setAttribute('aria-label', 'Delete entry');
    delBtn.textContent = '×';
    delBtn.addEventListener('click', () => deleteEntry(entry.id));
    actionsTd.appendChild(delBtn);
    tr.appendChild(actionsTd);

    ledgerBody.appendChild(tr);
  });

  sumIncome.textContent = formatCurrency(income);
  sumExpense.textContent = formatCurrency(expense);
  sumBalance.textContent = formatCurrency(income - expense);
}

function formatCurrency(n) {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 3500);
}
