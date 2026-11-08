const state = {
  accounts: {}, summary: null, extras: null, ids: [], account: null,
  view: 'overview', goalMonths: 3,
  shock: { income: 100, bills: 0, repair: 0, extra: 0, preset: 'custom' },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const money = (value, decimals = 0) => new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', maximumFractionDigits: decimals, minimumFractionDigits: decimals,
}).format(value);
const number = (value) => new Intl.NumberFormat('en-CA').format(value);
const percent = (value) => `${value.toFixed(1)}%`;
const esc = (value) => String(value).replace(/[&<>"']/g, (s) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[s]));

let toastTimer;
function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('shown'), 3000);
}

function runway(buffer, income, spending, oneOff = 0) {
  const remaining = buffer - oneOff;
  const gap = spending - income;
  if (remaining <= 0) return 0;
  if (gap <= 0) return null;
  return Math.min(remaining / gap, 120);
}

function runwayText(value, withUnit = true) {
  if (value === null) return withUnit ? '120+ months' : '120+';
  return `${value.toFixed(1)}${withUnit ? ' months' : ''}`;
}

function scenario() {
  const { I, S, H, B } = state.account;
  const { income, bills, repair, extra } = state.shock;
  const afterIncome = I * income / 100;
  const afterSpending = S + H * bills / 100 + extra;
  const remaining = B - repair;
  const gap = afterSpending - afterIncome;
  return { afterIncome, afterSpending, remaining, gap, value: runway(B, afterIncome, afterSpending, repair) };
}

function setView(view) {
  if (!$('#view-' + view)) return;
  state.view = view;
  document.body.dataset.view = view;
  $$('.view').forEach((node) => node.classList.toggle('active', node.id === 'view-' + view));
  $$('.nav-item').forEach((node) => node.classList.toggle('active', node.dataset.view === view));
  $('#active-view-label').textContent = view.toUpperCase();
  $('.sidebar').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function loadAccount(id) {
  const normalized = String(id).trim();
  const account = state.accounts[normalized];
  if (!account) {
    $('#finder-error').textContent = 'Account not found. Choose an ID from the supplied dataset.';
    toast('That account ID is not in the dataset');
    return;
  }
  $('#finder-error').textContent = '';
  $('#account-input').value = normalized;
  state.account = account;
  renderAll();
  toast(`Account ${normalized} loaded`);
}

function renderOverview() {
  const a = state.account;
  $('#account-label').textContent = '#' + a.id;
  $('#account-period').textContent = `${a.months} months of history · ${a.first} to ${a.last} · ${a.region}`;
  $('#metric-income').textContent = money(a.I);
  $('#metric-spend').textContent = money(a.S);
  $('#metric-fixed').textContent = money(a.F);
  $('#metric-buffer').textContent = money(a.B);
  const baseline = runway(a.B, a.I, a.S);
  $('#baseline-runway').textContent = runwayText(baseline, false);
  $('#baseline-track').style.width = `${baseline === null ? 100 : Math.max(0, Math.min(100, baseline / 12 * 100))}%`;
  const badge = $('#position-pill');
  badge.classList.remove('status-good', 'status-warn', 'status-risk');
  if (a.B <= 0) { badge.textContent = 'No buffer'; badge.classList.add('status-risk'); }
  else if (a.S > a.I) { badge.textContent = 'Monthly shortfall'; badge.classList.add('status-warn'); }
  else { badge.textContent = 'No monthly shortfall'; badge.classList.add('status-good'); }
  $('#net-cashflow').textContent = money(a.I - a.S);
  $('#household-bills').textContent = money(a.H);
  $('#loan-payment').textContent = money(a.P);
  $('#months-history').textContent = `${a.months} months`;
  renderCashflowChart(a.series.slice(-12));
}

function svgChart(labels, dataSets, options = {}) {
  const chartStyle = getComputedStyle(document.documentElement);
  const chartColor = (name) => chartStyle.getPropertyValue(name).trim();
  const W = 750, H = options.height || 260, pad = { t: 12, r: 15, b: 38, l: 60 };
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
  const values = dataSets.flatMap((data) => data.values);
  const top = Math.max(1, ...values, 0), bottom = options.includeZeroNegative ? Math.min(0, ...values) : 0;
  const high = top === bottom ? top + 1 : top * 1.09;
  const low = bottom < 0 ? bottom * 1.08 : 0;
  const y = (v) => pad.t + (high - v) / (high - low) * ph;
  const x = (i) => pad.l + i / Math.max(1, labels.length - 1) * pw;
  const labelMoney = (n) => Math.abs(n) >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${Math.round(n)}`;
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const value = low + (high - low) * i / 4;
    const yy = y(value);
    grid += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${yy}" y2="${yy}" stroke="${chartColor('--border')}" stroke-dasharray="4 7" opacity=".9"/><text x="${pad.l - 11}" y="${yy + 4}" fill="${chartColor('--text-muted')}" font-size="11" text-anchor="end">${labelMoney(value)}</text>`;
  }
  const every = labels.length <= 6 ? 1 : Math.ceil(labels.length / 6);
  labels.forEach((label, i) => {
    if (i % every === 0 || i === labels.length - 1) grid += `<text x="${x(i)}" y="${H - 10}" fill="${chartColor('--text-muted')}" font-size="11" text-anchor="middle">${esc(label)}</text>`;
  });
  if (options.bars) {
    const groupW = pw / Math.max(1, labels.length);
    let bars = '';
    dataSets.forEach((set, series) => set.values.forEach((value, i) => {
      const barW = Math.min(19, groupW * .32);
      const xx = pad.l + groupW * (i + .5) + (series === 0 ? -barW - 1 : 1);
      const yy = y(Math.max(value, 0));
      bars += `<rect x="${xx}" y="${yy}" width="${barW}" height="${Math.max(0, y(0) - yy)}" rx="3" fill="${set.color}" opacity=".89"><title>${esc(labels[i])}: ${money(value, 2)} ${esc(set.label)}</title></rect>`;
    }));
    const ticks = labels.map((label,i) => pad.l + groupW*(i+.5));
    grid = grid.replace(/(<text x=")([^\"]+)(" y="[^\"]+" fill="#7f94aa"[^>]+>)/g, (_, before, xv, after) => before + xv + after);
    return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">${grid}${bars}</svg>`;
  }
  let lines = '';
  dataSets.forEach((set, index) => {
    const points = set.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    if (options.area && index === 0) {
      lines += `<polygon points="${x(0)},${y(0)} ${points} ${x(labels.length - 1)},${y(0)}" fill="${set.color}" opacity=".11"/>`;
    }
    lines += `<polyline points="${points}" fill="none" stroke="${set.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    set.values.forEach((v,i) => { lines += `<circle cx="${x(i)}" cy="${y(v)}" r="2.6" fill="${set.color}"><title>Month ${i}: ${money(v,2)}</title></circle>`; });
  });
  if (options.includeZeroNegative) lines += `<line x1="${pad.l}" x2="${W-pad.r}" y1="${y(0)}" y2="${y(0)}" stroke="${chartColor('--risk')}" stroke-dasharray="6 5" opacity=".7"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">${grid}${lines}</svg>`;
}

function renderCashflowChart(series) {
  const css = getComputedStyle(document.documentElement);
  const labels = series.map((r) => r[0].slice(2));
  const moneyIn = series.map((r) => r[1]), moneyOut = series.map((r) => r[2]);
  $('#cashflow-chart').innerHTML = svgChart(labels, [
    { label: 'money in', values: moneyIn, color: css.getPropertyValue('--good').trim() },
    { label: 'money out', values: moneyOut, color: css.getPropertyValue('--orange').trim() },
  ], { bars: true });
  $('#cashflow-chart').setAttribute('aria-label', `Monthly inflows and outflows for account ${state.account.id}, ${series[0]?.[0]} to ${series.at(-1)?.[0]}`);
}

function renderShock() {
  const sc = scenario();
  const { shock } = state;
  const values = [ ['income', 'income-range', 'income-value', (x) => `${x}%`], ['bills', 'bills-range', 'bills-value', (x) => `${x}%`], ['repair', 'repair-range', 'repair-value', money], ['extra', 'extra-range', 'extra-value', money] ];
  values.forEach(([key, rangeId, outputId, format]) => {
    const range = $('#' + rangeId);
    if (key === 'repair') range.max = Math.max(100000, Math.ceil(state.account.S / 1000) * 1000, Math.ceil((state.extras?.accounts?.[state.account.id]?.extraWorstSpending || 0) / 1000) * 1000);
    range.value = shock[key];
    $('#' + outputId).textContent = format(shock[key]);
  });
  $('#scenario-name').textContent = ({ custom: 'Custom', job: 'Job loss', bills: 'Higher bills', repair: 'Emergency repair', combo: 'Double shock', reset: 'No shock' })[shock.preset];
  $$('.preset').forEach((node) => node.classList.toggle('active', node.dataset.preset === shock.preset));
  $('#shock-runway').textContent = runwayText(sc.value, false);
  $('#shock-description').textContent = sc.remaining <= 0 ? 'The one time cost uses the entire modeled buffer.' : sc.gap <= 0 ? 'Typical monthly inflows still cover outflows under this scenario.' : `The buffer would cover approximately ${runwayText(sc.value)} of the monthly shortfall.`;
  $('#shock-income').textContent = money(sc.afterIncome);
  $('#shock-spending').textContent = money(sc.afterSpending);
  $('#shock-buffer').textContent = money(sc.remaining);
  $('#shock-gap').textContent = money(Math.max(0, sc.gap));
  $('#formula-text').textContent = sc.remaining <= 0
    ? `Buffer after repair: ${money(sc.remaining, 2)}. No buffer remains, so runway is zero.`
    : sc.gap <= 0
      ? `Spending ${money(sc.afterSpending, 2)} does not exceed income ${money(sc.afterIncome, 2)}. No modeled monthly shortfall (120+).`
      : `${money(sc.remaining, 2)} ÷ ${money(sc.gap, 2)} = ${runwayText(sc.value)}`;
  renderProjection(sc);
}

function renderProjection(sc) {
  const expire = $('#ei-expiry').checked;
  const duration = Number($('#ei-duration')?.value || 6);
  const values = [sc.remaining];
  for (let month = 1; month <= 12; month++) {
    const expiredIncome = expire && state.shock.income < 100 && month > duration ? 0 : sc.afterIncome;
    values.push(values.at(-1) + expiredIncome - sc.afterSpending);
  }
  $('#projection-chart').innerHTML = svgChart(
    Array.from({ length: 13 }, (_, i) => i === 0 ? 'Now' : `M${i}`),
    [{ label: 'remaining buffer', values, color: getComputedStyle(document.documentElement).getPropertyValue('--orange').trim() }],
    { area: true, includeZeroNegative: true, height: 260 },
  );
  $('#projection-chart').setAttribute('aria-label', `Projected buffer after 12 months: ${money(values.at(-1))}. ${expire ? 'With modeled income ending after month ' + duration + '.' : 'With the same monthly shock throughout.'}`);
}

function renderPlans() {
  const a = state.account;
  const target = state.goalMonths * a.S;
  const current = Math.max(0, a.B);
  const needed = Math.max(0, target - current);
  const surplus = a.I - a.S;
  $('#fund-target').textContent = money(target);
  $('#fund-current').textContent = money(a.B);
  $('#fund-remaining').textContent = money(needed);
  $('#fund-surplus').textContent = money(surplus);
  $('#fund-progress').style.width = `${target > 0 ? Math.min(100, Math.max(0,current/target*100)) : 100}%`;
  $$('.segmented button').forEach((node) => node.classList.toggle('active', Number(node.dataset.goalMonths) === state.goalMonths));
  let goalText;
  if (target === 0) goalText = 'The median spending is zero. Review the underlying months before deciding on a meaningful savings target.';
  else if (needed <= 0) goalText = `Your current buffer proxy already meets the ${state.goalMonths} month target. Consider keeping it available for genuine emergencies.`;
  else if (surplus > 0) goalText = `If you can save the modeled monthly surplus of ${money(surplus)}, reaching your target would take about ${number(Math.ceil(needed/surplus))} months. A 12 month target would require ${money(needed/12)} per month.`;
  else goalText = `Typical spending is ${money(-surplus)} above money in. There is no reliable modeled monthly surplus yet. To close that gap and fund the target in 12 months, the budget would need to improve by about ${money(-surplus + needed/12)} per month.`;
  $('#goal-recommendation').textContent = goalText;
  const sc = scenario();
  const gap = Math.max(0, sc.gap);
  const cut = gap * .25;
  const newRunway = runway(a.B, sc.afterIncome, sc.afterSpending - cut, state.shock.repair);
  $('#backup-gap').textContent = money(gap);
  $('#backup-runway').textContent = runwayText(sc.value);
  $('#backup-cut').textContent = money(cut);
  $('#backup-extended').textContent = runwayText(newRunway);
  let backupText;
  if (sc.remaining <= 0) backupText = `The one time expense exceeds the modeled buffer by ${money(-sc.remaining)}. A spending reduction alone will not restore runway immediately. Prioritize replacing the emergency buffer and reviewing payment obligations.`;
  else if (gap <= 0) backupText = 'This scenario does not produce a monthly shortfall. Keep monitoring actual expenses and avoid treating a bank balance as guaranteed emergency savings.';
  else backupText = `A monthly reduction of ${money(cut)} would reduce the modeled shortfall by 25% and extend runway to ${runwayText(newRunway)}. Completely closing the shortfall would require ${money(gap)} each month. Review variable spending and repayment options to see what is actually adjustable.`;
  $('#backup-recommendation').textContent = backupText;
  if (typeof renderExtras === 'function' && state.extras) renderExtras();
}

function renderInsights() {
  const d = state.summary;
  const active = d.active_loan, other = d.no_active_loan, all = d.overall;
  const a = active.under_6 / active.accounts * 100;
  const b = other.under_6 / other.accounts * 100;
  $('#discovery-ratio').textContent = `${(a / b).toFixed(2)}×`;
  $('#loan-cohort-n').textContent = `${number(active.accounts)} accounts`;
  $('#no-loan-cohort-n').textContent = `${number(other.accounts)} accounts`;
  $('#loan-rate').textContent = percent(a);
  $('#no-loan-rate').textContent = percent(b);
  $('#loan-bar').style.width = `${a}%`;
  $('#no-loan-bar').style.width = `${b}%`;
  $('#all-under3').textContent = `${number(all.under_3)} / ${number(all.accounts)}`;
  $('#all-under6').textContent = `${number(all.under_6)} / ${number(all.accounts)}`;
  $('#all-nogap').textContent = number(all.no_shortfall);
  $('#all-median').textContent = all.median_runway + ' mo';
}

function renderAll() {
  renderOverview();
  renderShock();
  renderPlans();
  renderInsights();
}

function applyPreset(name) {
  const a = state.account;
  const presets = {
    job: { income: 55, bills: 0, repair: 0, extra: 0 },
    bills: { income: 100, bills: 15, repair: 0, extra: 0 },
    repair: { income: 100, bills: 0, repair: a.S, extra: 0 },
    combo: { income: 55, bills: 15, repair: 0, extra: 0 },
    reset: { income: 100, bills: 0, repair: 0, extra: 0 },
  };
  state.shock = { ...presets[name], preset: name };
  renderShock();
  renderPlans();
}

async function copyGeminiPrompt() {
  const a = state.account;
  const sc = scenario();
  const prompt = `You are reviewing a financial resilience scenario for an anonymized historical bank account. Explain the arithmetic clearly and provide a cautious goal and contingency plan. Do not invent facts about salary, employment, living costs, or customer identity. Use these exact account-level numbers in CAD:\n\nMedian monthly money in: ${money(a.I,2)}\nMedian monthly money out: ${money(a.S,2)}\nMedian fixed costs: ${money(a.F,2)}\nMedian household bills: ${money(a.H,2)}\nAverage daily balance over the last six months: ${money(a.B,2)}\nScenario: income retained ${state.shock.income}%, household bills up ${state.shock.bills}%, one-time cost ${money(state.shock.repair,2)}, other monthly expense ${money(state.shock.extra,2)}\nShocked income: ${money(sc.afterIncome,2)}, shocked spending: ${money(sc.afterSpending,2)}, buffer left: ${money(sc.remaining,2)}, monthly shortfall: ${money(Math.max(0,sc.gap),2)}\nBenchmark runway: ${runwayText(sc.value)}\n\nGive a short plain-language explanation, a realistic emergency-fund goal, a contingency action plan, and limitations. This dataset includes transfers in 'money in', so it is not verified employment income. Never claim the EI estimate is an eligibility determination. Highlight that financial choices require reviewing the actual account transactions.`;
  try { await navigator.clipboard.writeText(prompt); toast('Gemini prompt copied. Paste it into Google AI Studio.'); }
  catch { toast('Clipboard unavailable in this browser'); }
}

function downloadScenarioReport() {
  const a = state.account;
  const sc = scenario();
  const rows = [
    ['Metric', 'Value'],
    ['Account ID', a.id],
    ['Data months', a.months],
    ['Typical monthly money in (CAD)', a.I],
    ['Typical monthly spending (CAD)', a.S],
    ['Typical fixed costs (CAD)', a.F],
    ['Typical household bills (CAD)', a.H],
    ['Buffer (CAD)', a.B],
    ['Active loan payment (CAD)', a.P],
    ['Income retained (%)', state.shock.income],
    ['Household bill increase (%)', state.shock.bills],
    ['One time cost (CAD)', state.shock.repair],
    ['Extra monthly cost (CAD)', state.shock.extra],
    ['Income after shock (CAD)', sc.afterIncome.toFixed(2)],
    ['Spending after shock (CAD)', sc.afterSpending.toFixed(2)],
    ['Buffer left (CAD)', sc.remaining.toFixed(2)],
    ['Monthly gap (CAD)', Math.max(0, sc.gap).toFixed(2)],
    ['Runway (months)', runwayText(sc.value, false)],
    ['Emergency fund target (CAD)', (state.goalMonths * a.S).toFixed(2)],
    ['Method', 'Tangerine Resilience Rewired challenge README benchmark'],
    ['Warning', 'Modeled scenario. Money in may include transfers. Not verified employment income.'],
    ['Source', 'PKDD 1999 CTU Prague Financial dataset'],
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = `resilience-report-${a.id}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Scenario report downloaded');
}

function attachEvents() {
  $$('.nav-item').forEach((node) => node.addEventListener('click', () => setView(node.dataset.view)));
  $$('[data-view-link]').forEach((node) => node.addEventListener('click', () => setView(node.dataset.viewLink)));
  $('#mobile-nav-toggle').addEventListener('click', () => $('.sidebar').classList.toggle('open'));
  $('#load-account').addEventListener('click', () => loadAccount($('#account-input').value));
  $('#account-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') loadAccount(event.target.value); });
  $$('[data-account]').forEach((node) => node.addEventListener('click', () => loadAccount(node.dataset.account)));
  $('#random-account').addEventListener('click', () => loadAccount(state.ids[Math.floor(Math.random() * state.ids.length)]));
  $('#overview-shock').addEventListener('click', () => setView('shock'));
  $('#reset-scenario').addEventListener('click', () => applyPreset('reset'));
  $$('[data-preset]').forEach((node) => node.addEventListener('click', () => applyPreset(node.dataset.preset)));
  [['income-range','income'], ['bills-range','bills'], ['repair-range','repair'], ['extra-range','extra']].forEach(([id,key]) => {
    $('#' + id).addEventListener('input', (e) => { state.shock[key] = Number(e.target.value); state.shock.preset = 'custom'; renderShock(); renderPlans(); });
  });
  $('#ei-expiry').addEventListener('change', () => renderProjection(scenario()));
  $('#ei-duration').addEventListener('input', () => { renderProjection(scenario()); if (state.extras) renderExtras(); });
  $$('[data-goal-months]').forEach((node) => node.addEventListener('click', () => { state.goalMonths = Number(node.dataset.goalMonths); renderPlans(); }));
  $('#copy-gemini').addEventListener('click', copyGeminiPrompt);
  $('#export-report').addEventListener('click', downloadScenarioReport);
  if (typeof attachExtraEvents === 'function') attachExtraEvents();
}

async function main() {
  try {
    if (window.__REWIRED_EMBEDDED) {
      state.accounts = window.__REWIRED_EMBEDDED.accounts;
      state.summary = window.__REWIRED_EMBEDDED.summary;
      state.extras = window.__REWIRED_EMBEDDED.extras || {accounts: {}, cohorts: {}};
    } else {
      const [accountsResponse, summaryResponse, extrasResponse] = await Promise.all([
        fetch('/data/accounts.json'), fetch('/data/summary.json'), fetch('/data/extras.json'),
      ]);
      if (!accountsResponse.ok || !summaryResponse.ok || !extrasResponse.ok) throw Error('Could not download the challenge data');
      state.accounts = await accountsResponse.json();
      state.summary = await summaryResponse.json();
      state.extras = await extrasResponse.json();
    }
    state.ids = Object.keys(state.accounts);
    attachEvents();
    state.account = state.accounts['21109'] || state.accounts[state.ids[0]];
    document.body.dataset.view = 'overview';
    $('#account-input').value = state.account.id;
    renderAll();
    $('#loading').hidden = true;
    $('#app').hidden = false;
  } catch (error) {
    console.error(error);
    $('#loading').innerHTML = `<div class="loader-mark">!</div><div>Could not load the challenge data. Refresh to try again.</div>`;
  }
}

main();
