// Smart Credit Ledger Management System - frontend only
// Data lives in-memory; refresh clears everything. Designed for desktop.

// --- In-memory state -------------------------------------------------------
const state = {
  today: new Date('2026-01-19'),
  customers: [
    { id: 1, name: 'Aurora Stores', phone: '555-1010', address: '14 Market Ave', creditLimit: 5000, notes: 'Low-risk retail', createdAt: '2025-12-01' },
    { id: 2, name: 'Beacon Wholesale', phone: '555-2233', address: '88 Harbor Road', creditLimit: 4000, notes: 'Pays within 10 days', createdAt: '2025-12-10' },
    { id: 3, name: 'Cobalt Foods', phone: '555-3344', address: '12 Orchard St', creditLimit: 3200, notes: 'Seasonal spikes', createdAt: '2025-12-14' },
    { id: 4, name: 'Delta Hardware', phone: '555-7788', address: '71 Tool Park', creditLimit: 4500, notes: 'Large invoices', createdAt: '2026-01-03' }
  ],
  credits: [
    { id: 1, customerId: 1, amount: 1200, date: '2025-12-20', dueDate: '2026-01-05', remarks: 'Net 15', reminderSent: false },
    { id: 2, customerId: 2, amount: 900, date: '2025-12-28', dueDate: '2026-01-10', remarks: 'Net 12', reminderSent: true },
    { id: 3, customerId: 3, amount: 1400, date: '2026-01-02', dueDate: '2026-01-16', remarks: 'Holiday stock', reminderSent: false },
    { id: 4, customerId: 4, amount: 1800, date: '2026-01-05', dueDate: '2026-01-20', remarks: 'Tools batch', reminderSent: false }
  ],
  payments: [
    { id: 1, customerId: 1, amount: 500, date: '2026-01-04', type: 'Partial', method: 'Bank', note: 'ACH' },
    { id: 2, customerId: 2, amount: 300, date: '2026-01-08', type: 'Partial', method: 'Cash', note: 'Counter' },
    { id: 3, customerId: 1, amount: 200, date: '2026-01-10', type: 'Partial', method: 'Card', note: 'POS' }
  ],
  reminders: [
    { customerId: 1, last: '2026-01-12', count: 2, next: '2026-01-19', status: 'Queued' },
    { customerId: 2, last: '2026-01-09', count: 1, next: '2026-01-17', status: 'Sent' },
    { customerId: 3, last: '2026-01-14', count: 1, next: '2026-01-21', status: 'Planned' }
  ],
  history: [
    { ts: '2025-12-20 09:00', customerId: 1, type: 'Credit', amount: 1200, marker: 'Net 15' },
    { ts: '2025-12-28 11:10', customerId: 2, type: 'Credit', amount: 900, marker: 'Net 12' },
    { ts: '2026-01-02 10:00', customerId: 3, type: 'Credit', amount: 1400, marker: 'Holiday' },
    { ts: '2026-01-03 08:50', customerId: 4, type: 'Customer', amount: 0, marker: 'Onboarded' },
    { ts: '2026-01-04 12:00', customerId: 1, type: 'Payment', amount: 500, marker: 'Partial' },
    { ts: '2026-01-05 15:10', customerId: 4, type: 'Credit', amount: 1800, marker: 'Tools batch' },
    { ts: '2026-01-08 09:50', customerId: 2, type: 'Payment', amount: 300, marker: 'Partial' },
    { ts: '2026-01-10 17:20', customerId: 1, type: 'Payment', amount: 200, marker: 'POS' }
  ]
};

// --- Utilities --------------------------------------------------------------
const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const parseDate = (str) => { const [y, m, d] = (str || '').split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const daysBetween = (a, b) => Math.floor((a.setHours(0, 0, 0, 0) - b.setHours(0, 0, 0, 0)) / 86400000);

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

// --- Derived calculations ---------------------------------------------------
function customerTotals(customerId) {
  const totalCredit = state.credits.filter(c => c.customerId === customerId).reduce((s, c) => s + c.amount, 0);
  const totalPayments = state.payments.filter(p => p.customerId === customerId).reduce((s, p) => s + p.amount, 0);
  const balance = totalCredit - totalPayments;
  const today = state.today;
  const overdueCredits = state.credits.filter(c => c.customerId === customerId && parseDate(c.dueDate) < today);
  const overdueAmount = overdueCredits.reduce((s, c) => s + c.amount, 0) - totalPayments;
  const overdueDays = overdueCredits.map(c => daysBetween(today, parseDate(c.dueDate))); // positive numbers
  const maxOverdue = overdueDays.length ? Math.max(...overdueDays) : 0;
  const utilization = totalCredit ? balance / totalCredit : 0;
  return { totalCredit, totalPayments, balance, overdueAmount: Math.max(overdueAmount, 0), maxOverdue, utilization };
}

function globalTotals() {
  const totalCustomers = state.customers.length;
  const totalCredit = state.credits.reduce((s, c) => s + c.amount, 0);
  const totalPayments = state.payments.reduce((s, p) => s + p.amount, 0);
  const outstanding = totalCredit - totalPayments;
  const overdue = state.customers.reduce((s, c) => s + customerTotals(c.id).overdueAmount, 0);
  const overdueCount = state.customers.filter(c => customerTotals(c.id).overdueAmount > 0).length;
  const newThisWeek = state.customers.filter(c => daysBetween(state.today, parseDate(c.createdAt)) <= 7).length;
  return { totalCustomers, totalCredit, totalPayments, outstanding, overdue, overdueCount, newThisWeek };
}

function riskScore(custId) {
  const t = customerTotals(custId);
  const overduePenalty = Math.min(60, t.maxOverdue * 1.2);
  const utilizationPenalty = Math.max(0, (t.utilization - 0.7) * 60);
  const base = 95 - overduePenalty - utilizationPenalty;
  return Math.max(15, Math.round(base));
}

// --- Rendering helpers ------------------------------------------------------
function renderBars(container, data, colorClass = '') {
  container.innerHTML = '';
  data.forEach(row => {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.innerHTML = `
      <div class="fill ${colorClass}" style="width:${row.value}%"></div>
      <div class="label">${row.label}</div>
      <div class="value">${row.value}%</div>
    `;
    container.appendChild(bar);
  });
}

// --- Rendering: Dashboard ---------------------------------------------------
let dashboardTrendChart = null;
let dashboardRecoveryChart = null;

function renderDashboard() {
  const totals = globalTotals();
  document.getElementById('kpiCustomers').textContent = fmt(totals.totalCustomers);
  document.getElementById('kpiNewCustomers').textContent = `${fmt(totals.newThisWeek)} new this week`;
  document.getElementById('kpiCredit').textContent = fmtMoney(totals.totalCredit);
  document.getElementById('kpiCollected').textContent = fmtMoney(totals.totalPayments);
  document.getElementById('kpiOutstanding').textContent = fmtMoney(totals.outstanding);
  document.getElementById('kpiOverdue').textContent = `${fmt(totals.overdue)} overdue flagged`;

  // Chart.js: credit vs payments
  const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
  const creditSeries = [6800, 7200, 7500, 8100, 8400, totals.totalCredit];
  const paySeries = [3900, 4100, 4600, 5200, 5400, totals.totalPayments];

  const trendCtx = document.getElementById('chartTrendCanvas');
  if (trendCtx) {
    if (dashboardTrendChart) dashboardTrendChart.destroy();
    dashboardTrendChart = new Chart(trendCtx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          { label: 'Credit', data: creditSeries, backgroundColor: '#304ffe' },
          { label: 'Payments', data: paySeries, backgroundColor: '#10b981' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // Chart.js: recovery pie (collected vs outstanding)
  const recoveryCtx = document.getElementById('chartRecoveryCanvas');
  if (recoveryCtx) {
    if (dashboardRecoveryChart) dashboardRecoveryChart.destroy();
    const collected = totals.totalPayments;
    const outstanding = Math.max(0, totals.outstanding);
    dashboardRecoveryChart = new Chart(recoveryCtx, {
      type: 'pie',
      data: {
        labels: ['Collected', 'Outstanding'],
        datasets: [{
          data: [collected, outstanding],
          backgroundColor: ['#10b981', '#f59e0b'],
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right' } }
      }
    });
  }

  // Aging buckets
  renderAging();

  // Watchlist (sorted by overdue then balance)
  const watch = clone(state.customers)
    .map(c => ({ ...c, ...customerTotals(c.id) }))
    .filter(c => c.overdueAmount > 0)
    .sort((a, b) => b.overdueAmount - a.overdueAmount)
    .slice(0, 4);
  const wlBody = document.querySelector('#watchlistTable tbody');
  wlBody.innerHTML = '';
  watch.forEach(c => {
    const score = riskScore(c.id);
    const risk = score > 75 ? 'Low' : score > 55 ? 'Medium' : 'High';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.name}</td>
      <td>${fmtMoney(c.balance)}</td>
      <td>${fmtMoney(c.overdueAmount)}</td>
      <td><span class="badge ${risk.toLowerCase()}">${risk}</span></td>
    `;
    wlBody.appendChild(tr);
  });
}

function renderAging() {
  const buckets = { b7: 0, b30: 0, b30p: 0 };
  const rows = [];
  const today = state.today;
  state.credits.forEach(c => {
    const due = parseDate(c.dueDate);
    const days = daysBetween(today, due);
    if (days <= 0) return;
    if (days <= 7) buckets.b7 += c.amount;
    else if (days <= 30) buckets.b30 += c.amount;
    else buckets.b30p += c.amount;
    rows.push({ label: `${state.customers.find(x => x.id === c.customerId)?.name || c.customerId}`, days });
  });

  document.querySelector('#bucket7 .value').textContent = fmtMoney(buckets.b7);
  document.querySelector('#bucket30 .value').textContent = fmtMoney(buckets.b30);
  document.querySelector('#bucket30p .value').textContent = fmtMoney(buckets.b30p);

  const aging = document.getElementById('agingBuckets');
  aging.innerHTML = '';
  rows.slice(0, 4).forEach(r => {
    const div = document.createElement('div');
    div.className = 'bucket';
    div.innerHTML = `<span>${r.label}</span><span class="badge warning">${r.days} days</span>`;
    aging.appendChild(div);
  });
}

// --- Customers -------------------------------------------------------------
function renderCustomers() {
  const tbody = document.querySelector('#customerTable tbody');
  tbody.innerHTML = '';
  state.customers.forEach(c => {
    const t = customerTotals(c.id);
    const overdueBadge = t.overdueAmount > 0 ? '<span class="badge high">Overdue</span>' : '<span class="badge low">Clear</span>';
    const risk = riskScore(c.id);
    const riskTag = risk > 75 ? 'low' : risk > 55 ? 'medium' : 'high';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${c.name}</strong><div class="small">${c.address || ''}</div></td>
      <td>${c.phone}</td>
      <td class="align-right">${fmtMoney(c.creditLimit)}</td>
      <td class="align-right">${fmtMoney(t.balance)}</td>
      <td class="align-right">${fmtMoney(t.overdueAmount)}</td>
      <td><span class="badge ${riskTag}">${riskTag.toUpperCase()}</span> ${overdueBadge}</td>
      <td>${c.notes || ''}</td>
      <td><button class="btn ghost edit-btn" data-id="${c.id}" data-type="customer">Edit</button></td>
    `;
    tbody.appendChild(tr);
  });
  attachEditListeners();
  populateCustomerSelects();
}

function populateCustomerSelects() {
  const opts = state.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  ['creditCustomer', 'paymentCustomer'].forEach(id => {
    document.getElementById(id).innerHTML = `<option value="">Select customer</option>${opts}`;
  });
}

// --- Credits ---------------------------------------------------------------
function renderCredits() {
  const tbody = document.querySelector('#creditTable tbody');
  tbody.innerHTML = '';
  const today = state.today;
  state.credits.forEach(c => {
    const cust = state.customers.find(x => x.id === c.customerId);
    const due = parseDate(c.dueDate);
    const daysLeft = daysBetween(due, today) * -1;
    const rowClass = daysLeft < 0 ? 'danger' : daysLeft <= 3 ? 'warn' : '';
    const tr = document.createElement('tr');
    tr.className = rowClass;
    tr.innerHTML = `
      <td>${cust?.name || c.customerId}</td>
      <td class="align-right">${fmtMoney(c.amount)}</td>
      <td>${c.date}</td>
      <td>${c.dueDate}</td>
      <td class="align-center">${daysLeft >= 0 ? daysLeft : `${Math.abs(daysLeft)} overdue`}</td>
      <td>${c.remarks || ''}</td>
      <td><button class="btn ghost edit-btn" data-id="${c.id}" data-type="credit">Edit</button></td>
    `;
    tbody.appendChild(tr);
  });
  attachEditListeners();
}

// --- Payments --------------------------------------------------------------
function renderPayments() {
  const tbody = document.querySelector('#paymentTable tbody');
  tbody.innerHTML = '';
  state.payments.slice().sort((a, b) => parseDate(b.date) - parseDate(a.date)).forEach(p => {
    const cust = state.customers.find(x => x.id === p.customerId);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${cust?.name || p.customerId}</td>
      <td class="align-right">${fmtMoney(p.amount)}</td>
      <td>${p.date}</td>
      <td>${p.type || 'Partial'}</td>
      <td>${p.method || ''}</td>
      <td>${p.note || ''}</td>
      <td><button class="btn ghost edit-btn" data-id="${p.id}" data-type="payment">Edit</button></td>
    `;
    tbody.appendChild(tr);
  });
  attachEditListeners();
}

// --- Overdue ---------------------------------------------------------------
function renderOverdue() {
  const tbody = document.querySelector('#overdueTable tbody');
  tbody.innerHTML = '';
  const today = state.today;
  const buckets = { b7: 0, b30: 0, b30p: 0 };

  state.credits.forEach(c => {
    const due = parseDate(c.dueDate);
    if (due >= today) return;
    const days = daysBetween(today, due);
    const cust = state.customers.find(x => x.id === c.customerId);
    const outstanding = Math.max(0, c.amount - state.payments.filter(p => p.customerId === c.customerId).reduce((s, p) => s + p.amount, 0));
    const bucket = days <= 7 ? '1-7' : days <= 30 ? '8-30' : '30+';
    if (bucket === '1-7') buckets.b7 += outstanding; else if (bucket === '8-30') buckets.b30 += outstanding; else buckets.b30p += outstanding;
    const badge = bucket === '1-7' ? 'info' : bucket === '8-30' ? 'warning' : 'high';
    const tr = document.createElement('tr');
    tr.className = bucket === '30+' ? 'danger' : 'warn';
    tr.innerHTML = `
      <td>${cust?.name || c.customerId}</td>
      <td>${c.dueDate}</td>
      <td>${days}</td>
      <td class="align-right">${fmtMoney(outstanding)}</td>
      <td><span class="badge ${badge}">${bucket} days</span></td>
      <td>${c.reminderSent ? 'Reminder sent' : 'Pending'}</td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelector('#bucket7 .value').textContent = fmtMoney(buckets.b7);
  document.querySelector('#bucket30 .value').textContent = fmtMoney(buckets.b30);
  document.querySelector('#bucket30p .value').textContent = fmtMoney(buckets.b30p);
}

// --- Reminders -------------------------------------------------------------
function renderReminders() {
  const tbody = document.querySelector('#reminderTable tbody');
  tbody.innerHTML = '';
  state.reminders.forEach(r => {
    const cust = state.customers.find(c => c.id === r.customerId);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${cust?.name || r.customerId}</td>
      <td>${r.last}</td>
      <td>${r.count}</td>
      <td>${r.next}</td>
      <td><span class="tag ${r.status === 'Sent' ? 'green' : 'yellow'}">${r.status}</span></td>
    `;
    tbody.appendChild(tr);
  });

  const history = document.getElementById('reminderHistory');
  history.innerHTML = '';
  state.reminders.slice(0, 5).forEach(r => {
    const cust = state.customers.find(c => c.id === r.customerId);
    const li = document.createElement('li');
    li.textContent = `${r.last}: Reminder ${r.status} for ${cust?.name || r.customerId}`;
    history.appendChild(li);
  });
}

// --- Analytics Charts ------
let analyticsReliabilityChart = null;
let analyticsOverdueChart = null;

// --- Analytics -------------------------------------------------------------
function renderAnalytics() {
  const totals = globalTotals();
  document.getElementById('reportDues').textContent = fmtMoney(totals.outstanding);
  document.getElementById('reportRecovered').textContent = fmtMoney(totals.totalPayments);
  const recoveryRate = totals.totalCredit ? Math.round((totals.totalPayments / totals.totalCredit) * 100) : 0;
  document.getElementById('reportRecoveryRate').textContent = `${recoveryRate}%`;
  const medianReliability = median(state.customers.map(c => riskScore(c.id)));
  document.getElementById('reportReliability').textContent = fmt(medianReliability);

  // Reliability Distribution - Pie Chart
  const reliabilities = [
    { label: '90-100 (Excellent)', value: countScores(90, 100), color: '#10b981' },
    { label: '75-89 (Good)', value: countScores(75, 89), color: '#3b82f6' },
    { label: '55-74 (Fair)', value: countScores(55, 74), color: '#f59e0b' },
    { label: '0-54 (Poor)', value: countScores(0, 54), color: '#ef4444' }
  ];

  const pieCtx = document.getElementById('chartReliabilityPie').getContext('2d');
  if (analyticsReliabilityChart) analyticsReliabilityChart.destroy();
  analyticsReliabilityChart = new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels: reliabilities.map(r => r.label),
      datasets: [{
        data: reliabilities.map(r => r.value),
        backgroundColor: reliabilities.map(r => r.color),
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 15, font: { size: 12 }, usePointStyle: true }
        }
      }
    }
  });

  // Overdue Trend - Bar Chart
  const overdueTrend = [18, 16, 15, 12, 10, 9];
  const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
  
  const barCtx = document.getElementById('chartOverdueBar').getContext('2d');
  if (analyticsOverdueChart) analyticsOverdueChart.destroy();
  analyticsOverdueChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [{
        label: 'Overdue Cases (%)',
        data: overdueTrend.map(v => v * 4),
        backgroundColor: '#ef4444',
        borderColor: '#dc2626',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          labels: { padding: 15, font: { size: 12 } }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { font: { size: 11 } },
          title: { display: true, text: 'Percentage (%)' }
        },
        x: {
          ticks: { font: { size: 11 } }
        }
      }
    }
  });
}

function countScores(min, max) {
  return state.customers.filter(c => {
    const s = riskScore(c.id);
    return s >= min && s <= max;
  }).length;
}

function median(arr) {
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// --- Risk ------------------------------------------------------------------
function renderRisk() {
  const tbody = document.querySelector('#riskTable tbody');
  tbody.innerHTML = '';
  state.customers.forEach(c => {
    const t = customerTotals(c.id);
    const score = riskScore(c.id);
    const utilizationPct = Math.round(t.utilization * 100);
    const tag = score > 75 ? 'green' : score > 55 ? 'yellow' : 'red';
    const reason = t.maxOverdue > 0 ? `${t.maxOverdue} days overdue` : 'On-time';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.name}</td>
      <td>
        <div class="progress"><div class="fill" style="width:${score}%"></div></div>
        <div class="legend">${score}/100</div>
      </td>
      <td>${utilizationPct}%</td>
      <td>${t.maxOverdue}</td>
      <td><span class="tag ${tag}">${tag.toUpperCase()}</span></td>
      <td>${reason}</td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Ledger ----------------------------------------------------------------
function renderLedger() {
  const tbody = document.querySelector('#ledgerTable tbody');
  tbody.innerHTML = '';
  let running = 0;
  state.history
    .slice()
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .forEach(item => {
      running += item.type === 'Credit' ? item.amount : item.type === 'Payment' ? -item.amount : 0;
      const cust = state.customers.find(c => c.id === item.customerId);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.ts}</td>
        <td>${cust?.name || item.customerId}</td>
        <td>${item.type}</td>
        <td class="align-right">${fmtMoney(item.amount)}</td>
        <td class="align-right">${fmtMoney(running)}</td>
        <td class="marker">${item.marker}</td>
      `;
      tbody.appendChild(tr);
    });
}

// --- Forms and actions ------------------------------------------------------
function attachEditListeners() {
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = Number(btn.dataset.id);
      const type = btn.dataset.type;

      if (type === 'customer') {
        const customer = state.customers.find(c => c.id === id);
        if (customer) {
          document.getElementById('custId').value = customer.id;
          document.getElementById('custName').value = customer.name;
          document.getElementById('custPhone').value = customer.phone;
          document.getElementById('custAddress').value = customer.address;
          document.getElementById('custLimit').value = customer.creditLimit;
          document.getElementById('custNotes').value = customer.notes;
          document.getElementById('custSubmitBtn').textContent = 'Update Customer';
          switchSection('customers');
        }
      } else if (type === 'credit') {
        const credit = state.credits.find(c => c.id === id);
        if (credit) {
          document.getElementById('creditId').value = credit.id;
          document.getElementById('creditCustomer').value = credit.customerId;
          document.getElementById('creditAmount').value = credit.amount;
          document.getElementById('creditDate').value = credit.date;
          document.getElementById('creditDue').value = credit.dueDate;
          document.getElementById('creditRemarks').value = credit.remarks;
          document.getElementById('creditSubmitBtn').textContent = 'Update Credit';
          switchSection('credit');
        }
      } else if (type === 'payment') {
        const payment = state.payments.find(p => p.id === id);
        if (payment) {
          document.getElementById('paymentId').value = payment.id;
          document.getElementById('paymentCustomer').value = payment.customerId;
          document.getElementById('paymentAmount').value = payment.amount;
          document.getElementById('paymentDate').value = payment.date;
          document.getElementById('paymentType').value = payment.type;
          document.getElementById('paymentMethod').value = payment.method;
          document.getElementById('paymentNote').value = payment.note;
          document.getElementById('paymentSubmitBtn').textContent = 'Update Payment';
          switchSection('payments');
        }
      }
    });
  });
}

function setupNav() {
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => switchSection(btn.dataset.target));
  });
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => switchSection(btn.dataset.target));
  });
}

function switchSection(id) {
  document.querySelectorAll('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.target === id));
  document.querySelectorAll('.section').forEach(sec => sec.classList.toggle('active', sec.id === id));
}

function setupCustomerForm() {
  const form = document.getElementById('customerForm');
  const submitBtn = document.getElementById('custSubmitBtn');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const custId = Number(document.getElementById('custId').value || 0);
    const name = document.getElementById('custName').value.trim();
    const phone = document.getElementById('custPhone').value.trim();
    const address = document.getElementById('custAddress').value.trim();
    const limit = Number(document.getElementById('custLimit').value);
    const notes = document.getElementById('custNotes').value.trim();
    
    if (!name || !phone || !Number.isFinite(limit)) return;

    if (custId > 0) {
      // Update existing customer
      const cust = state.customers.find(c => c.id === custId);
      if (cust) {
        cust.name = name;
        cust.phone = phone;
        cust.address = address;
        cust.creditLimit = limit;
        cust.notes = notes;
      }
    } else {
      // Add new customer
      const newId = Math.max(0, ...state.customers.map(c => c.id)) + 1;
      state.customers.push({ id: newId, name, phone, address, creditLimit: limit, notes, createdAt: formatDate(state.today) });
    }
    
    form.reset();
    document.getElementById('custId').value = '';
    submitBtn.textContent = 'Save Customer';
    renderAll();
  });

  document.getElementById('btnAddCustomer').addEventListener('click', () => {
    form.reset();
    document.getElementById('custId').value = '';
    submitBtn.textContent = 'Save Customer';
    switchSection('customers');
  });
  
  document.getElementById('btnResetCustomer').addEventListener('click', () => {
    form.reset();
    document.getElementById('custId').value = '';
    submitBtn.textContent = 'Save Customer';
  });
}

function setupCreditForm() {
  const form = document.getElementById('creditForm');
  const amountEl = document.getElementById('creditAmount');
  const custEl = document.getElementById('creditCustomer');
  const notice = document.getElementById('limitNotice');
  const submitBtn = document.getElementById('creditSubmitBtn');

  function checkLimit() {
    const custId = Number(custEl.value);
    const amt = Number(amountEl.value);
    const creditId = Number(document.getElementById('creditId').value || 0);
    const cust = state.customers.find(c => c.id === custId);
    if (!cust || !Number.isFinite(amt)) { notice.hidden = true; return; }
    const totals = customerTotals(custId);
    let projected = totals.balance + amt;
    // If editing, subtract the old amount first
    if (creditId > 0) {
      const oldCredit = state.credits.find(c => c.id === creditId);
      if (oldCredit) {
        projected = totals.balance - oldCredit.amount + amt;
      }
    }
    notice.hidden = !(projected > cust.creditLimit);
  }

  amountEl.addEventListener('input', checkLimit);
  custEl.addEventListener('change', checkLimit);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const creditId = Number(document.getElementById('creditId').value || 0);
    const custId = Number(custEl.value);
    const amount = Number(amountEl.value);
    const date = document.getElementById('creditDate').value;
    const due = document.getElementById('creditDue').value;
    const remarks = document.getElementById('creditRemarks').value.trim();
    if (!custId || !Number.isFinite(amount) || !date || !due) return;

    if (creditId > 0) {
      // Update existing credit
      const credit = state.credits.find(c => c.id === creditId);
      if (credit) {
        credit.customerId = custId;
        credit.amount = amount;
        credit.date = date;
        credit.dueDate = due;
        credit.remarks = remarks;
      }
    } else {
      // Add new credit
      const newId = Math.max(0, ...state.credits.map(c => c.id)) + 1;
      state.credits.push({ id: newId, customerId: custId, amount, date, dueDate: due, remarks, reminderSent: false });
      state.history.push({ ts: `${date} 10:00`, customerId: custId, type: 'Credit', amount, marker: remarks || 'Credit' });
    }
    
    form.reset();
    document.getElementById('creditId').value = '';
    submitBtn.textContent = 'Add Credit';
    notice.hidden = true;
    renderAll();
  });

  document.getElementById('btnResetCredit').addEventListener('click', () => {
    form.reset();
    document.getElementById('creditId').value = '';
    submitBtn.textContent = 'Add Credit';
    notice.hidden = true;
  });
}

function setupPaymentForm() {
  const form = document.getElementById('paymentForm');
  const submitBtn = document.getElementById('paymentSubmitBtn');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const paymentId = Number(document.getElementById('paymentId').value || 0);
    const custId = Number(document.getElementById('paymentCustomer').value);
    const amount = Number(document.getElementById('paymentAmount').value);
    const date = document.getElementById('paymentDate').value;
    const type = document.getElementById('paymentType').value;
    const method = document.getElementById('paymentMethod').value;
    const note = document.getElementById('paymentNote').value.trim();
    if (!custId || !Number.isFinite(amount) || !date) return;

    if (paymentId > 0) {
      // Update existing payment
      const payment = state.payments.find(p => p.id === paymentId);
      if (payment) {
        payment.customerId = custId;
        payment.amount = amount;
        payment.date = date;
        payment.type = type;
        payment.method = method;
        payment.note = note;
      }
    } else {
      // Add new payment
      const newId = Math.max(0, ...state.payments.map(p => p.id)) + 1;
      state.payments.push({ id: newId, customerId: custId, amount, date, type, method, note });
      state.history.push({ ts: `${date} 16:00`, customerId: custId, type: 'Payment', amount, marker: type });
    }
    
    form.reset();
    document.getElementById('paymentId').value = '';
    submitBtn.textContent = 'Add Payment';
    renderAll();
  });

  document.getElementById('btnResetPayment').addEventListener('click', () => {
    form.reset();
    document.getElementById('paymentId').value = '';
    submitBtn.textContent = 'Add Payment';
  });
}

function setupSimulateDay() {
  document.getElementById('simulateDay').addEventListener('click', () => {
    state.today = addDays(state.today, 1);
    renderAll();
  });
}

function setupReset() {
  const resetBtn = document.getElementById('btnReset');
  if (!resetBtn) return;
  resetBtn.addEventListener('click', () => {
    state.customers.length = 0;
    state.credits.length = 0;
    state.payments.length = 0;
    state.reminders.length = 0;
    state.history.length = 0;
    renderAll();
  });
}

function setupCurrencyConversion() {
  const btn = document.getElementById('btnConvert');
  if (!btn) return;
  
  btn.addEventListener('click', () => {
    const amountInr = Number(document.getElementById('amountUsd').value || 0);
    
    document.getElementById('resultUsd').textContent = fmtMoney(amountInr);
    document.getElementById('resultInr').textContent = fmtMoney(amountInr);
    document.getElementById('conversionResult').style.display = 'grid';
    
    // Update INR charts with new amount value
    setTimeout(() => renderInrBarChart(), 100);
  });
}

// --- Helpers ----------------------------------------------------------------
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// --- Render All 

// --- Charts & Currency Conversion ------------------------------------------
let barChartInstance = null;
let pieChartInstance = null;
let paymentMethodChartInstance = null;
let inrBarChartInstance = null;

function renderCharts() {
  renderBarChart();
  renderPieChart();
  renderPaymentMethodChart();
  renderInrBarChart();
}

function renderBarChart() {
  const ctx = document.getElementById('barChart');
  if (!ctx) return;
  
  const creditByCustomer = {};
  const paymentByCustomer = {};
  
  state.customers.forEach(c => {
    creditByCustomer[c.name] = state.credits.filter(cr => cr.customerId === c.id).reduce((s, cr) => s + cr.amount, 0);
    paymentByCustomer[c.name] = state.payments.filter(p => p.customerId === c.id).reduce((s, p) => s + p.amount, 0);
  });
  
  const labels = Object.keys(creditByCustomer);
  const creditData = labels.map(l => creditByCustomer[l]);
  const paymentData = labels.map(l => paymentByCustomer[l]);
  
  if (barChartInstance) barChartInstance.destroy();
  
  barChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Credit Issued',
          data: creditData,
          backgroundColor: '#304ffe',
          borderColor: '#304ffe',
          borderWidth: 1
        },
        {
          label: 'Payments Collected',
          data: paymentData,
          backgroundColor: '#10b981',
          borderColor: '#10b981',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'top' }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function renderPieChart() {
  const ctx = document.getElementById('pieChart');
  if (!ctx) return;
  
  const creditByCustomer = {};
  const colors = ['#304ffe', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];
  
  state.customers.forEach((c, idx) => {
    creditByCustomer[c.name] = state.credits.filter(cr => cr.customerId === c.id).reduce((s, cr) => s + cr.amount, 0);
  });
  
  if (pieChartInstance) pieChartInstance.destroy();
  
  pieChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.keys(creditByCustomer),
      datasets: [{
        data: Object.values(creditByCustomer),
        backgroundColor: colors.slice(0, Object.keys(creditByCustomer).length),
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'right' }
      }
    }
  });
}

function renderPaymentMethodChart() {
  const ctx = document.getElementById('paymentMethodChart');
  if (!ctx) return;
  
  const byMethod = {};
  const colors = ['#304ffe', '#0ea5e9', '#10b981'];
  
  state.payments.forEach(p => {
    const method = p.method || 'Unknown';
    byMethod[method] = (byMethod[method] || 0) + p.amount;
  });
  
  if (paymentMethodChartInstance) paymentMethodChartInstance.destroy();
  
  paymentMethodChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.keys(byMethod),
      datasets: [{
        data: Object.values(byMethod),
        backgroundColor: colors.slice(0, Object.keys(byMethod).length),
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'right' }
      }
    }
  });
}

function renderInrBarChart() {
  const ctx = document.getElementById('inrBarChart');
  if (!ctx) return;
  const creditByCustomer = {};
  
  state.customers.forEach(c => {
    creditByCustomer[c.name] = state.credits.filter(cr => cr.customerId === c.id).reduce((s, cr) => s + cr.amount, 0);
  });
  
  const labels = Object.keys(creditByCustomer);
  const inrData = labels.map(l => creditByCustomer[l]);
  
  if (inrBarChartInstance) inrBarChartInstance.destroy();
  
  inrBarChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Credit (₹)',
        data: inrData,
        backgroundColor: '#f59e0b',
        borderColor: '#d97706',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'top' }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// --- Render All ------------------------------------------------------------
function renderAll() {
  renderDashboard();
  renderCustomers();
  renderCredits();
  renderPayments();
  renderOverdue();
  renderReminders();
  renderAnalytics();
  renderRisk();
  renderLedger();
}

// --- Init ------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  setupNav();
  setupCustomerForm();
  setupCreditForm();
  setupPaymentForm();
  setupSimulateDay();
  setupReset();
  renderAll();
});
