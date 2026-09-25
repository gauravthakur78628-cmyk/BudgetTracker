const auth = firebase.auth();
const db = firebase.firestore();

const appScreen = document.getElementById('app-screen');
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
const chartCanvas = document.getElementById('trend-chart');
const chartEmpty = document.getElementById('chart-empty');

let unsubscribeEntries = null;
let trendChart = null;

appScreen.hidden = true; // stay hidden until we confirm the user is signed in
entryDate.value = new Date().toISOString().slice(0, 10);

// ===== Route guard: bounce back to login if not signed in =====
auth.onAuthStateChanged((user) => {
  if (user) {
    appScreen.hidden = false;
    userEmailEl.textContent = user.email;
    listenToEntries(user.uid);
  } else {
    if (unsubscribeEntries) { unsubscribeEntries(); unsubscribeEntries = null; }
    window.location.href = 'index.html';
  }
});

logoutBtn.addEventListener('click', () => auth.signOut());

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
        renderChart(entries);
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

// ===== Income vs. expenses trend chart (last 6 months) =====
function renderChart(entries) {
  // Build the last 6 months as "YYYY-MM" keys, oldest first.
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
      label: d.toLocaleDateString(undefined, { month: 'short' }),
    });
  }

  const incomeByMonth = Object.fromEntries(months.map((m) => [m.key, 0]));
  const expenseByMonth = Object.fromEntries(months.map((m) => [m.key, 0]));

  entries.forEach((entry) => {
    const key = entry.date.slice(0, 7); // "YYYY-MM"
    if (!(key in incomeByMonth)) return; // outside the 6-month window
    if (entry.type === 'income') incomeByMonth[key] += entry.amount;
    else expenseByMonth[key] += entry.amount;
  });

  const hasAnyData = entries.some((e) => months.some((m) => e.date.slice(0, 7) === m.key));
  chartCanvas.parentElement.hidden = !hasAnyData;
  chartEmpty.hidden = hasAnyData;
  if (!hasAnyData) return;

  const rootStyles = getComputedStyle(document.documentElement);
  const incomeColor = rootStyles.getPropertyValue('--green').trim();
  const expenseColor = rootStyles.getPropertyValue('--rust').trim();
  const gridColor = rootStyles.getPropertyValue('--line').trim();
  const textColor = rootStyles.getPropertyValue('--ink-soft').trim();

  const data = {
    labels: months.map((m) => m.label),
    datasets: [
      {
        label: 'Income',
        data: months.map((m) => incomeByMonth[m.key]),
        backgroundColor: incomeColor,
        borderRadius: 3,
        maxBarThickness: 28,
      },
      {
        label: 'Expenses',
        data: months.map((m) => expenseByMonth[m.key]),
        backgroundColor: expenseColor,
        borderRadius: 3,
        maxBarThickness: 28,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: textColor, font: { family: 'Inter', size: 11 } },
        grid: { color: gridColor },
      },
      x: {
        ticks: { color: textColor, font: { family: 'Inter', size: 12 } },
        grid: { display: false },
      },
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: textColor, boxWidth: 10, font: { family: 'Inter', size: 12 } },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ctx.dataset.label + ': ' + formatCurrency(ctx.raw),
        },
      },
    },
  };

  if (trendChart) {
    trendChart.data = data;
    trendChart.options = options;
    trendChart.update();
  } else {
    trendChart = new Chart(chartCanvas.getContext('2d'), { type: 'bar', data, options });
  }
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
