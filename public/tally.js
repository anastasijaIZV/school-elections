// public/tally.js — grouped by position (one row per ministry)
const boards = document.getElementById('boards');
const adminPassInput = document.getElementById('adminPass');
document.getElementById('reload').onclick = load;

async function api(path, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-admin-pass': adminPassInput.value || '',
    ...(opts.headers || {})
  };
  const res = await fetch(path, { ...opts, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// CSV upload/import
const csvFile = document.getElementById('csvFile');
const importBtn = document.getElementById('importBtn');
const importMode = document.getElementById('importMode');

if (importBtn) {
  importBtn.onclick = async () => {
    if (!csvFile.files || !csvFile.files[0]) {
      alert('Choose a CSV file first.');
      return;
    }
    const text = await csvFile.files[0].text();
    const mode = importMode?.value || 'merge';
    try {
      const res = await api('/api/candidates/import', {
        method: 'POST',
        body: JSON.stringify({ csv: text, mode })
      });
      await load();
      alert(`Import complete (${mode}). Inserted: ${res.inserted ?? 0} / Rows: ${res.totalCsvRows ?? 0}`);
    } catch (e) {
      alert('Import failed: ' + e);
    }
  };
}


function positionRowHtml(p) {
  const candHtml = p.candidates.map(c => `
    <div class="cand" data-cid="${c.id}">
      <div class="info">
        <span class="name">${c.name}</span>
        <span class="class">${c.class}</span>
      </div>
      <div class="controls">
        <button class="btn dec" data-id="${c.id}" aria-label="decrement">−</button>
        <span class="count" data-id="${c.id}">${c.count}</span>
        <button class="btn inc" data-id="${c.id}" aria-label="increment">+</button>
      </div>
    </div>
  `).join('');

  return `
    <tr>
      <td class="pos">
        <div class="pos-title">${p.title}</div>
        <button class="mini reset-pos" data-pos="${p.key}">Reset</button>
      </td>
      <td>
        <div class="cand-row">${candHtml}</div>
      </td>
    </tr>
  `;
}

async function load() {
  boards.innerHTML = 'Loading…';
  const data = await fetch('/api/overview').then(r => r.json());

  boards.innerHTML = `
    <div class="subbar">
      <button id="resetAllBtn" title="Set all counts to 0">Reset All</button>
    </div>
    <table id="tallyTable">
      <thead>
        <tr>
          <th style="width:220px">Position</th>
          <th>Candidates</th>
        </tr>
      </thead>
      <tbody>
        ${data.positions.map(positionRowHtml).join('')}
      </tbody>
    </table>
  `;

  // Reset All
  document.getElementById('resetAllBtn').onclick = async () => {
    if (!confirm('Reset ALL tallies to 0?')) return;
    await api('/api/tally/reset', { method: 'POST', body: JSON.stringify({}) });
    load();
  };
}

// Event delegation for +/− and per-position reset
boards.addEventListener('click', async (e) => {
  const resetBtn = e.target.closest('.reset-pos');
  if (resetBtn) {
    if (!confirm(`Reset ${resetBtn.dataset.pos}?`)) return;
    await api('/api/tally/reset', {
      method: 'POST',
      body: JSON.stringify({ position_key: resetBtn.dataset.pos })
    });
    return load();
  }

  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.getAttribute('data-id');
  if (!id) return;

  const inc = btn.classList.contains('inc');
  const path = inc ? '/api/tally/increment' : '/api/tally/decrement';
  const { count } = await api(path, {
    method: 'POST',
    body: JSON.stringify({ candidateId: Number(id) })
  });
  document.querySelector(`.count[data-id="${id}"]`).textContent = count;
});

// Keyboard shortcuts: remember last candidate clicked, then use +/- keys
let lastCandidateId = null;
boards.addEventListener('click', (e) => {
  const cand = e.target.closest('.cand');
  if (cand) lastCandidateId = Number(cand.dataset.cid);
});
window.addEventListener('keydown', async (e) => {
  if (!lastCandidateId) return;
  if (e.key === '+') {
    const { count } = await api('/api/tally/increment', {
      method: 'POST',
      body: JSON.stringify({ candidateId: lastCandidateId })
    });
    document.querySelector(`.count[data-id="${lastCandidateId}"]`).textContent = count;
  } else if (e.key === '-' || e.key === '_') {
    const { count } = await api('/api/tally/decrement', {
      method: 'POST',
      body: JSON.stringify({ candidateId: lastCandidateId })
    });
    document.querySelector(`.count[data-id="${lastCandidateId}"]`).textContent = count;
  }
});

load();

// Light polling: refresh only the numbers every 2s so multiple tellers stay in sync
setInterval(async () => {
    try {
      const data = await fetch('/api/overview').then(r => r.json());
      data.positions.forEach(p => p.candidates.forEach(c => {
        const el = document.querySelector(`.count[data-id="${c.id}"]`);
        if (el) el.textContent = c.count;
      }));
    } catch {}
  }, 2000);
  