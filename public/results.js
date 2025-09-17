// public/results.js
const content = document.getElementById('content');
const refreshBtn = document.getElementById('refresh');
if (refreshBtn) refreshBtn.onclick = load;

// palette (8 colors; cycles if more bars)
const PALETTE = [
  { bg: 'rgba(228,61,48,0.35)',  border: 'rgba(228,61,48,1)'  }, // main red/orange
  { bg: 'rgba(71,88,134,0.35)',  border: 'rgba(71,88,134,1)'  }, // main red/orange
  { bg: 'rgba(16,185,129,0.35)',  border: 'rgba(16,185,129,1)'  }, // emerald
  { bg: 'rgba(139,92,246,0.35)',  border: 'rgba(139,92,246,1)'  }, // violet
  { bg: 'rgba(245,158,11,0.35)',  border: 'rgba(245,158,11,1)'  }, // amber
  { bg: 'rgba(236,72,153,0.35)',  border: 'rgba(236,72,153,1)'  }, // pink
  { bg: 'rgba(34,197,94,0.35)',   border: 'rgba(34,197,94,1)'   }, // green
  { bg: 'rgba(14,165,233,0.35)',  border: 'rgba(14,165,233,1)'  }, // sky
];

// plugin: draw a subtle border around the chart *area*
const chartAreaBorder = {
  id: 'chartAreaBorder',
  afterDraw(chart, args, opts) {
    const {ctx, chartArea} = chart;
    if (!chartArea) return;
    ctx.save();
    ctx.strokeStyle = opts.borderColor || '#cbd5e1'; // slate-300
    ctx.lineWidth = opts.borderWidth || 1;
    ctx.strokeRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
    ctx.restore();
  }
};

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
      (p.candidates || []).slice().sort((a,b)=>b.count-a.count).forEach(c => {
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
