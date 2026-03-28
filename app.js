const RENDER_API = 'https://project1-backend-1-3ncm.onrender.com/api';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API = isLocal ? 'http://localhost:8080/api' : RENDER_API;

let currentUser = 'user1';

const NOTIF_CHECKBOXES = [
    ['CONSOLE', 'notif-console'],
    ['EMAIL', 'notif-email'],
    ['SMS', 'notif-sms'],
    ['DASHBOARD', 'notif-dashboard']
];

async function fetchDashboard() {
    const res = await fetch(`${API}/dashboard?userId=${encodeURIComponent(currentUser)}`);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
}

async function fetchStrategy() {
    const res = await fetch(`${API}/strategy`);
    if (!res.ok) throw new Error('Failed to fetch strategy');
    return res.json();
}

async function updateStrategy(strategy) {
    const res = await fetch(`${API}/strategy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.reason || 'Failed to update strategy');
    return data;
}

function formatMoney(n) {
    return '$' + Number(n).toFixed(2);
}

function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString();
}

function renderDashboard(data) {
    currentUser = data.userId;
    document.getElementById('cash').textContent = formatMoney(data.cash);
    document.getElementById('totalValue').textContent = formatMoney(data.totalValue);
    hydrateUsers(data.users, data.userId);

    const pricesBody = document.querySelector('#prices-table tbody');
    pricesBody.innerHTML = data.stocks
        .map(s => `<tr><td>${s.stock}</td><td>${formatMoney(s.price)}</td></tr>`)
        .join('');

    const holdingsBody = document.querySelector('#holdings-table tbody');
    holdingsBody.innerHTML = data.holdings.length === 0
        ? '<tr><td colspan="3">No holdings</td></tr>'
        : data.holdings.map(h => {
            const val = h.quantity * h.currentPrice;
            return `<tr><td>${h.stock}</td><td>${h.quantity}</td><td>${formatMoney(val)}</td></tr>`;
        }).join('');

    const pendingBody = document.querySelector('#pending-table tbody');
    pendingBody.innerHTML = data.pendingOrders.length === 0
        ? '<tr><td colspan="5">No pending orders</td></tr>'
        : data.pendingOrders.map(o =>
            `<tr><td>${o.type}</td><td>${o.stock}</td><td class="side-${o.side.toLowerCase()}">${o.side}</td><td>${o.quantity}</td><td>${o.limitPrice ? formatMoney(o.limitPrice) : '-'}</td></tr>`
        ).join('');

    const historyBody = document.querySelector('#history-table tbody');
    historyBody.innerHTML = data.tradeHistory.length === 0
        ? '<tr><td colspan="6">No trades yet</td></tr>'
        : data.tradeHistory.slice().reverse().map(t =>
            `<tr><td>${formatTime(t.timestamp)}</td><td>${t.stock}</td><td class="side-${t.side.toLowerCase()}">${t.side}</td><td>${t.quantity}</td><td>${formatMoney(t.price)}</td><td>${formatMoney(t.totalValue)}</td></tr>`
        ).join('');

    const alerts = document.getElementById('alerts-list');
    alerts.innerHTML = (data.alerts || []).length === 0
        ? '<li>No alerts yet</li>'
        : data.alerts.slice().reverse().map(a => `<li>${formatTime(a.timestamp)} - ${a.message}</li>`).join('');

    const badge = document.getElementById('notification-badge');
    const count = data.notificationBadgeCount ?? 0;
    badge.textContent = count > 0 ? String(count) : '';
    badge.classList.toggle('has-badge', count > 0);

    const enabled = new Set(data.notificationChannels || []);
    for (const [name, id] of NOTIF_CHECKBOXES) {
        document.getElementById(id).checked = enabled.has(name);
    }
}

function hydrateUsers(users, selectedUser) {
    const userSelect = document.getElementById('user-select');
    if (userSelect.options.length === 0) {
        userSelect.innerHTML = users.map(u => `<option value="${u}">${u}</option>`).join('');
    }
    userSelect.value = selectedUser;
}

function showMessage(msg, isError) {
    const el = document.getElementById('order-message');
    el.textContent = msg;
    el.className = 'message ' + (isError ? 'error' : 'success');
    el.style.visibility = 'visible';
}

document.getElementById('order-type').addEventListener('change', e => {
    document.getElementById('limit-price').disabled = e.target.value !== 'LIMIT';
});

document.getElementById('order-form').addEventListener('submit', async e => {
    e.preventDefault();
    const type = document.getElementById('order-type').value;
    const side = document.getElementById('side').value;
    const stock = document.getElementById('stock').value.toUpperCase();
    const quantity = parseInt(document.getElementById('quantity').value, 10);
    const limitPrice = parseFloat(document.getElementById('limit-price').value) || 0;

    try {
        if (type === 'MARKET') {
            const res = await fetch(`${API}/orders/market`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser, stock, side, quantity })
            });
            const data = await res.json();
            if (res.ok) {
                showMessage(`Executed: ${side} ${data.trade.quantity} ${stock} @ ${formatMoney(data.trade.price)}`, false);
            } else {
                showMessage(data.reason || 'Order rejected', true);
            }
        } else {
            const res = await fetch(`${API}/orders/limit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser, stock, side, quantity, limitPrice })
            });
            const data = await res.json();
            if (res.ok) {
                showMessage(`Limit order placed (ID: ${data.orderId})`, false);
            } else {
                showMessage(data.reason || 'Order failed', true);
            }
        }
        refresh();
    } catch (err) {
        showMessage('Network error', true);
    }
});

document.getElementById('user-select').addEventListener('change', e => {
    currentUser = e.target.value;
    refresh();
});

async function saveNotificationChannels() {
    const channels = NOTIF_CHECKBOXES
        .filter(([, id]) => document.getElementById(id).checked)
        .map(([name]) => name);
    const res = await fetch(`${API}/users/${encodeURIComponent(currentUser)}/notification-channels`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels })
    });
    if (!res.ok) throw new Error('save failed');
}

for (const [, id] of NOTIF_CHECKBOXES) {
    document.getElementById(id).addEventListener('change', () => {
        saveNotificationChannels().catch(() => showMessage('Failed to save notification settings', true));
    });
}

document.getElementById('notification-badge').addEventListener('click', async () => {
    try {
        await fetch(`${API}/users/${encodeURIComponent(currentUser)}/notification-badge/clear`, { method: 'POST' });
        refresh();
    } catch (err) {
        showMessage('Failed to clear badge', true);
    }
});

document.getElementById('strategy-select').addEventListener('change', async e => {
    try {
        await updateStrategy(e.target.value);
        refresh();
    } catch (err) {
        showMessage('Failed to change strategy', true);
    }
});

function refresh() {
    fetchDashboard()
        .then(renderDashboard)
        .catch(() => {});
}

Promise.all([fetchStrategy(), fetchDashboard()])
    .then(([strategy, dashboard]) => {
        document.getElementById('strategy-select').value = strategy.current;
        renderDashboard(dashboard);
    })
    .catch(() => {});

setInterval(refresh, 2000);

