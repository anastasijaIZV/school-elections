// public/results.js
const content = document.getElementById('content');
const refreshBtn = document.getElementById('refresh');
if (refreshBtn) refreshBtn.onclick = load;

// palette (8 colors; cycles if more bars)
const PALETTE = [
    { bg: 'rgba(70,75,130,0.35)', border: 'rgba(70,75,130,1)' }, // main dark blue
    { bg: 'rgba(230,70,40,0.35)', border: 'rgba(230,70,40,1)' }, // main red/orange
    { bg: 'rgba(0,160,150,0.35)', border: 'rgba(0,160,150,1)' }, // zilganzaļš
    { bg: 'rgba(150,5,100,0.35)', border: 'rgba(150,5,100,1)' }, // violets
    { bg: 'rgba(125,165,30,0.35)', border: 'rgba(125,165,30,1)' }, // green
];

// plugin: draw a subtle border around the chart *area*
const chartAreaBorder = {
    id: 'chartAreaBorder',
    afterDraw(chart, args, opts) {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        ctx.save();
        ctx.strokeStyle = opts.borderColor || '#cbd5e1'; // slate-300
        ctx.lineWidth = opts.borderWidth || 1;
        ctx.strokeRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
        ctx.restore();
    }
};

const autoChk = document.getElementById('autoRefresh');

if (refreshBtn) refreshBtn.onclick = load;

let refreshTimer = null;
function setAutoRefresh(on) {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    if (on) {
        // refresh every 5s only when tab is visible
        refreshTimer = setInterval(() => {
            if (!document.hidden) load();
        }, 5000);
    }
}

// restore last setting (default OFF)
if (autoChk) {
    autoChk.checked = localStorage.getItem('results:auto') === '1';
    setAutoRefresh(autoChk.checked);
    autoChk.addEventListener('change', () => {
        localStorage.setItem('results:auto', autoChk.checked ? '1' : '0');
        setAutoRefresh(autoChk.checked);
    });
}

window.addEventListener('beforeunload', () => {
    if (refreshTimer) clearInterval(refreshTimer);
});

// initial render
load();


async function load() {
    try {
        content.innerHTML = 'Loading…';
        const res = await fetch('/api/overview');
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();

        content.innerHTML = '';
        if (!data.positions?.length) {
            content.innerHTML = '<div style="padding:16px;">No positions to show yet.</div>';
            return;
        }

        for (const p of data.positions) {
            const section = document.createElement('section');
            section.className = 'board';
            section.innerHTML = `<h2>${p.title}</h2>`;

            // Mini table
            const table = document.createElement('table');
            table.innerHTML = `<thead><tr><th>Candidate</th><th>Class</th><th>Votes</th></tr></thead>`;
            const tbody = document.createElement('tbody');
            (p.candidates || []).slice().sort((a, b) => b.count - a.count).forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${c.name}</td><td>${c.class}</td><td>${c.count}</td>`;
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);

            // Chart with colored bars + borders
            const chartBox = document.createElement('div');
            chartBox.className = 'chart-box';
            const canvas = document.createElement('canvas');
            canvas.style.height = '200px';
            chartBox.appendChild(canvas);

            section.appendChild(table);
            section.appendChild(chartBox);
            content.appendChild(section);

            if (typeof Chart === 'undefined') continue;

            const labels = (p.candidates || []).map(c => `${c.name} (${c.class})`);
            const counts = (p.candidates || []).map(c => c.count);
            const bg = counts.map((_, i) => PALETTE[i % PALETTE.length].bg);
            const border = counts.map((_, i) => PALETTE[i % PALETTE.length].border);

            new Chart(canvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        data: counts,
                        backgroundColor: bg,
                        borderColor: border,
                        borderWidth: 2,
                        borderRadius: 4,
                        hoverBorderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    plugins: {
                        legend: { display: false },
                        chartAreaBorder: { borderColor: '#cbd5e1', borderWidth: 1 }
                    },
                    scales: {
                        x: { grid: { display: false } },
                        y: {
                            beginAtZero: true,
                            ticks: { maxTicksLimit: 5 },
                            grid: { color: '#f1f5f9' } // very light grid for readability
                        }
                    }
                },
                plugins: [chartAreaBorder]
            });
        }
    } catch (err) {
        console.error(err);
        content.innerHTML = `<div style="padding:16px;color:crimson;">Failed to load results: ${err}</div>`;
    }
}

// initial render
load();
