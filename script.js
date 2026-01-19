/*
  Minimal JavaScript for desktop-only Customer Credit & Payment Management UI
  - Basic tab switching
  - Modal show/hide
  - Basic form validation
  - Dynamic table rendering
  - Simple overdue/warning highlighting
  NOTE: All data is in-memory only; no backend/database.
*/

// --- In-memory data model ----------------------------------------------------
const state = {
  customers: [
    { id: 1, name: 'Alice Traders', contact: '555-1010', creditLimit: 2000, notes: 'Frequent buyer' },
    { id: 2, name: 'Bright Supplies', contact: '555-2020', creditLimit: 1500, notes: 'Net 14 terms' },
    { id: 3, name: 'Cedar Mart', contact: '555-3030', creditLimit: 1000, notes: 'Seasonal spikes' }
  ],
  credits: [
    // Each credit: id, customerId, amount, dueDate(YYYY-MM-DD), notes, reminderSent(boolean)
    { id: 1, customerId: 1, amount: 500, dueDate: '2026-01-10', notes: 'Net 7', reminderSent: false },
    { id: 2, customerId: 2, amount: 800, dueDate: '2025-12-25', notes: 'Net 14', reminderSent: true },
    { id: 3, customerId: 3, amount: 300, dueDate: '2025-12-20', notes: 'Net 7', reminderSent: false }
  ],
  payments: [
    // Each payment: id, customerId, amount, date(YYYY-MM-DD), notes
    { id: 1, customerId: 1, amount: 200, date: '2026-01-05', notes: 'Partial' },
    { id: 2, customerId: 2, amount: 300, date: '2025-12-28', notes: 'Partial' }
  ]
};

// Utility: format currency as simple number with two decimals
function fmt(n) {
  return Number(n || 0).toFixed(2);
}

// Utility: parse YYYY-MM-DD into Date
function parseDate(str) {
  const [y, m, d] = (str || '').split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// Utility: days between two dates
function daysBetween(a, b) {
  const ms = a.setHours(0,0,0,0) - b.setHours(0,0,0,0);
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// Totals for a customer
function getCustomerTotals(customerId) {
  const totalCredit = state.credits.filter(c => c.customerId === customerId).reduce((s, c) => s + c.amount, 0);
  const totalPayments = state.payments.filter(p => p.customerId === customerId).reduce((s, p) => s + p.amount, 0);
  const balance = totalCredit - totalPayments;
  // Overdue logic: if any credit past due and balance still positive, consider overdue
  const today = new Date();
  const pastDueCredits = state.credits.filter(c => c.customerId === customerId && parseDate(c.dueDate) < today);
  const overdueAmount = balance > 0 && pastDueCredits.length ? Math.min(balance, pastDueCredits.reduce((s, c) => s + c.amount, 0)) : 0;
  return { totalCredit, totalPayments, balance, overdueAmount, hasOverdue: overdueAmount > 0 };
}

// Global totals
function getGlobalTotals() {
  const totalCustomers = state.customers.length;
  const totalCreditGiven = state.credits.reduce((s, c) => s + c.amount, 0);
  const totalPaymentsReceived = state.payments.reduce((s, p) => s + p.amount, 0);
  const totalOverdueAmount = state.customers.reduce((s, cust) => s + getCustomerTotals(cust.id).overdueAmount, 0);
  const overallOutstanding = totalCreditGiven - totalPaymentsReceived;
  const customersWithOverdue = state.customers.filter(c => getCustomerTotals(c.id).hasOverdue).length;
  return { totalCustomers, totalCreditGiven, totalPaymentsReceived, totalOverdueAmount, overallOutstanding, customersWithOverdue };
}

// --- Rendering ---------------------------------------------------------------
function renderDashboard() {
  const totals = getGlobalTotals();
  document.getElementById('totalCustomers').textContent = totals.totalCustomers;
  document.getElementById('totalCreditGiven').textContent = fmt(totals.totalCreditGiven);
  document.getElementById('totalOverdueAmount').textContent = fmt(totals.totalOverdueAmount);
  document.getElementById('totalPaymentsReceived').textContent = fmt(totals.totalPaymentsReceived);

  const tbody = document.querySelector('#dashboardCustomerTable tbody');
  tbody.innerHTML = '';
  state.customers.forEach(c => {
    const { balance, hasOverdue } = getCustomerTotals(c.id);
    const tr = document.createElement('tr');
    tr.className = hasOverdue ? 'status-overdue' : 'status-ok';
    tr.innerHTML = `
      <td>${c.name}</td>
      <td>${c.contact}</td>
      <td>${fmt(c.creditLimit)}</td>
      <td>${fmt(balance)}</td>
      <td>${hasOverdue ? 'Overdue' : 'OK'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderCustomers() {
  const tbody = document.querySelector('#customersTable tbody');
  tbody.innerHTML = '';
  state.customers.forEach(c => {
    const { balance, hasOverdue } = getCustomerTotals(c.id);
    const tr = document.createElement('tr');
    tr.className = hasOverdue ? 'status-overdue' : 'status-ok';
    tr.innerHTML = `
      <td>${c.name}</td>
      <td>${c.contact}</td>
      <td>${fmt(c.creditLimit)}</td>
      <td>${c.notes || ''}</td>
      <td>${fmt(balance)}</td>
      <td>${hasOverdue ? 'Overdue' : 'OK'}</td>
      <td>
        <button class="btn" data-action="edit" data-id="${c.id}">Edit</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTransactionSelects() {
  const custOpts = state.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('creditCustomerSelect').innerHTML = `<option value="" disabled selected>Select a customer</option>${custOpts}`;
  document.getElementById('paymentCustomerSelect').innerHTML = `<option value="" disabled selected>Select a customer</option>${custOpts}`;
}

function renderOverdue() {
  const tbody = document.querySelector('#overdueTable tbody');
  tbody.innerHTML = '';
  const today = new Date();

  // For each past-due credit, estimate outstanding as min(credit.amount, customer's outstanding)
  state.credits.forEach(c => {
    const due = parseDate(c.dueDate);
    if (due >= today) return; // Only past-due
    const totals = getCustomerTotals(c.customerId);
    if (totals.balance <= 0) return; // Nothing outstanding
    const cust = state.customers.find(x => x.id === c.customerId);
    const outstanding = Math.min(c.amount, totals.balance);
    const tr = document.createElement('tr');
    tr.className = 'status-overdue';
    tr.innerHTML = `
      <td>${cust ? cust.name : c.customerId}</td>
      <td>${c.dueDate}</td>
      <td>${daysBetween(today, due)}</td>
      <td>${fmt(outstanding)}</td>
      <td>${c.reminderSent ? 'Sent' : 'Not Sent'}</td>
      <td>
        <button class="btn" data-action="toggle-reminder" data-id="${c.id}">${c.reminderSent ? 'Mark Not Sent' : 'Mark Sent'}</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderSummary() {
  const totals = getGlobalTotals();
  document.getElementById('overallOutstanding').textContent = fmt(totals.overallOutstanding);
  document.getElementById('customersWithOverdue').textContent = totals.customersWithOverdue;

  const tbody = document.querySelector('#summaryTable tbody');
  tbody.innerHTML = '';
  state.customers.forEach(c => {
    const t = getCustomerTotals(c.id);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.name}</td>
      <td>${fmt(t.totalCredit)}</td>
      <td>${fmt(t.totalPayments)}</td>
      <td>${fmt(t.balance)}</td>
      <td>${fmt(t.overdueAmount)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAll() {
  renderDashboard();
  renderCustomers();
  renderTransactionSelects();
  renderOverdue();
  renderSummary();
}

// --- Navigation --------------------------------------------------------------
function setupTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const sectionId = btn.dataset.section;
      document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
      document.getElementById(sectionId).classList.add('active');
    });
  });

  document.querySelectorAll('.subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.subtab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const paneId = btn.dataset.pane;
      document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
      document.getElementById(paneId).classList.add('active');
    });
  });
}

// --- Modal: Customer add/edit -----------------------------------------------
function openCustomerModal(editCustomer) {
  const modal = document.getElementById('customerModal');
  const title = document.getElementById('customerModalTitle');
  const idEl = document.getElementById('customerId');
  const nameEl = document.getElementById('customerName');
  const contactEl = document.getElementById('customerContact');
  const limitEl = document.getElementById('customerLimit');
  const notesEl = document.getElementById('customerNotes');

  if (editCustomer) {
    title.textContent = 'Edit Customer';
    idEl.value = editCustomer.id;
    nameEl.value = editCustomer.name;
    contactEl.value = editCustomer.contact;
    limitEl.value = editCustomer.creditLimit;
    notesEl.value = editCustomer.notes || '';
  } else {
    title.textContent = 'Add Customer';
    idEl.value = '';
    nameEl.value = '';
    contactEl.value = '';
    limitEl.value = '';
    notesEl.value = '';
  }

  modal.hidden = false;
}

function closeCustomerModal() {
  document.getElementById('customerModal').hidden = true;
}

function setupCustomerModal() {
  document.getElementById('btnAddCustomer').addEventListener('click', () => openCustomerModal());
  document.getElementById('btnCancelCustomer').addEventListener('click', closeCustomerModal);

  // Edit buttons (event delegation)
  document.getElementById('customersTable').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action="edit"]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const cust = state.customers.find(c => c.id === id);
    if (cust) openCustomerModal(cust);
  });

  // Save customer
  document.getElementById('customerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('customerId').value;
    const name = document.getElementById('customerName').value.trim();
    const contact = document.getElementById('customerContact').value.trim();
    const limit = Number(document.getElementById('customerLimit').value);
    const notes = document.getElementById('customerNotes').value.trim();

    if (!name || !contact || !Number.isFinite(limit)) return;

    if (id) {
      const idx = state.customers.findIndex(c => c.id === Number(id));
      if (idx >= 0) state.customers[idx] = { ...state.customers[idx], name, contact, creditLimit: limit, notes };
    } else {
      const newId = Math.max(0, ...state.customers.map(c => c.id)) + 1;
      state.customers.push({ id: newId, name, contact, creditLimit: limit, notes });
    }

    closeCustomerModal();
    renderAll();
  });
}

// --- Transactions: Credit & Payment -----------------------------------------
function setupTransactions() {
  // Credit form limit warning
  const amtEl = document.getElementById('creditAmount');
  const custSel = document.getElementById('creditCustomerSelect');
  const warnEl = document.getElementById('limitWarning');

  function checkLimitWarning() {
    const custId = Number(custSel.value);
    const amt = Number(amtEl.value);
    const cust = state.customers.find(c => c.id === custId);
    if (!cust || !Number.isFinite(amt)) {
      warnEl.hidden = true;
      amtEl.classList.remove('limit-warning');
      return;
    }
    const totals = getCustomerTotals(custId);
    const projected = totals.balance + amt;
    const exceeds = projected > cust.creditLimit;
    warnEl.hidden = !exceeds;
    amtEl.classList.toggle('limit-warning', exceeds);
  }

  amtEl.addEventListener('input', checkLimitWarning);
  custSel.addEventListener('change', checkLimitWarning);

  // Save credit
  document.getElementById('creditForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const custId = Number(document.getElementById('creditCustomerSelect').value);
    const amount = Number(document.getElementById('creditAmount').value);
    const dueDate = document.getElementById('creditDueDate').value;
    const notes = document.getElementById('creditNotes').value.trim();
    if (!custId || !Number.isFinite(amount) || !dueDate) return;
    const newId = Math.max(0, ...state.credits.map(c => c.id)) + 1;
    state.credits.push({ id: newId, customerId: custId, amount, dueDate, notes, reminderSent: false });
    // Reset form
    e.target.reset();
    document.getElementById('limitWarning').hidden = true;
    document.getElementById('creditAmount').classList.remove('limit-warning');
    renderAll();
  });

  // Save payment
  document.getElementById('paymentForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const custId = Number(document.getElementById('paymentCustomerSelect').value);
    const amount = Number(document.getElementById('paymentAmount').value);
    const date = document.getElementById('paymentDate').value;
    const notes = document.getElementById('paymentNotes').value.trim();
    if (!custId || !Number.isFinite(amount) || !date) return;
    const newId = Math.max(0, ...state.payments.map(p => p.id)) + 1;
    state.payments.push({ id: newId, customerId: custId, amount, date, notes });
    e.target.reset();
    renderAll();
  });
}

// Overdue reminders toggle
function setupOverdueActions() {
  document.getElementById('overdueTable').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action="toggle-reminder"]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const idx = state.credits.findIndex(c => c.id === id);
    if (idx >= 0) state.credits[idx].reminderSent = !state.credits[idx].reminderSent;
    renderOverdue();
  });
}

// --- Init --------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupCustomerModal();
  setupTransactions();
  setupOverdueActions();
  renderAll();
});
