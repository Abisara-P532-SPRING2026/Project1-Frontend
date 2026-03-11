const RENDER_API = 'https://project1-backend-1-3ncm.onrender.com/api';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API = isLocal ? 'http://localhost:8080/api' : RENDER_API;

async function fetchDashboard() {
    const res = await fetch(`${API}/dashboard`);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
}

function formatMoney(n) {
    return '$' + Number(n).toFixed(2);
}

function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString();
}

function renderDashboard(data) {
    document.getElementById('cash').textContent = formatMoney(data.cash);
    document.getElementById('totalValue').textContent = formatMoney(data.totalValue);

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
                body: JSON.stringify({ stock, side, quantity })
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
                body: JSON.stringify({ stock, side, quantity, limitPrice })
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

function refresh() {
    fetchDashboard()
        .then(renderDashboard)
        .catch(() => {});
}

refresh();
setInterval(refresh, 2000);
