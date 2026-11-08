const extraUI = {
  incomeMode: 'typical',
  monthlySave: 300,
  monthlyCut: 100,
  checklist: new Set(),
};

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const extraByAccount = () => state.extras?.accounts?.[state.account?.id] || {};
const capRunway = (v) => v === null ? 120 : Math.max(0, Math.min(120, v));

function durationDate(months) {
  if (months === null) return 'No projected end date';
  if (!Number.isFinite(months)) return 'No date available';
  if (months <= 0) return 'Today';
  if (months >= 120) return 'Beyond 10 years';
  const target = new Date(Date.now() + months * 30.4375 * 86400000);
  return target.toLocaleDateString('en-CA', {month: 'short', year: 'numeric'});
}

function setRunwayClass(element, value) {
  element.classList.remove('status-good', 'status-warn', 'status-risk');
  element.classList.add(value === null || value >= 6 ? 'status-good' : value >= 3 ? 'status-warn' : 'status-risk');
}

function renderExtraOverview() {
  const a = state.account, x = extraByAccount();
  const base = runway(a.B, a.I, a.S);
  $('#baseline-date').textContent = durationDate(base);
  $('#baseline-date-detail').textContent = base === null
    ? 'Your typical inflows cover typical spending. There is no modeled monthly shortfall.'
    : base <= 0 ? 'Your available buffer is already at or below zero.'
    : `At your current monthly gap, your buffer lasts about ${runwayText(base)}.`;
  setRunwayClass($('#baseline-runway'), base);
  $('#baseline-calendar').innerHTML = Array.from({length: 12}, (_, i) => `<span class="${base === null || base > i ? 'filled' : ''}" title="Month ${i+1}"></span>`).join('');

  const keep = a.I > 0 ? (a.I - a.S) / a.I * 100 : 0;
  $('#cushion-amount').textContent = a.I <= 0 ? 'N/A' : keep < 0 ? `$${Math.abs(keep).toFixed(2)} overspent` : `$${Math.max(0, keep).toFixed(2)} kept`;
  $('#cushion-copy').textContent = a.I <= 0 ? 'No typical inflows available to calculate a cushion.' : keep < 0 ? 'For every $100 in, spending is higher by this amount.' : `Of every $100 coming in, around $${Math.max(0,keep).toFixed(2)} is left.`;
  $('#cushion-fill').style.width = `${Math.min(100, Math.max(0, a.I ? a.S / a.I * 100 : 100))}%`;
  const saved = a.S > 0 ? Math.max(0, a.B / a.S) : null;
  $('#safety-months').textContent = saved === null ? 'N/A' : `${saved.toFixed(1)} months`;
  $('#safety-fill').style.width = `${saved === null ? 0 : Math.min(100, saved / 6 * 100)}%`;

  const n = x.daysBelowZero || 0;
  $('#negative-headline').textContent = n ? `${n} days below $0 in your history` : 'No negative days in your monthly history';
  $('#negative-warning-card').classList.toggle('warning-card', n > 0);
  $('#negative-detail').textContent = n ? 'A balance dip is worth checking before future payments arrive.' : 'That is a positive sign, but it is not a guarantee about future expenses.';
  $('#negative-months').innerHTML = (x.negativeMonths || []).slice(-7).map(r => `<span>${esc(r.month)} · ${r.days}d</span>`).join('');

  const q = x.incomeGroup, cohorts = state.extras.cohorts?.quartiles || [];
  if (q === null || q === undefined || !cohorts[q]) {
    $('#peer-headline').textContent = 'Your inflows are pension led';
    $('#peer-detail').textContent = 'The income quartile comparison excludes pension-majority accounts.';
    $('#peer-marker').style.left = '50%';
    $('#peer-range').style.width = '0%';
  } else {
    const group = cohorts[q];
    $('#peer-headline').textContent = `${group.underSixPct.toFixed(1)}% of similar inflow accounts fall below 6 months`;
    $('#peer-detail').textContent = `You are in income group ${q + 1} of 4. ${number(group.n)} accounts in this group under the modeled 55% income shock.`;
    $('#peer-marker').style.left = `${Math.min(99, Math.max(1, x.peerPosition || 0))}%`;
    $('#peer-range').style.width = `${group.underSixPct}%`;
  }

  const orders = x.standingOrders || [];
  const percentCommitted = a.I > 0 ? x.standingTotal / a.I * 100 : 0;
  $('#committed-number').textContent = `${money(x.standingTotal || 0)} / month`;
  $('#committed-fill').style.width = `${Math.min(100, Math.max(0, percentCommitted))}%`;
  $('#standing-orders').innerHTML = orders.length
    ? `<details><summary>See ${orders.length} recurring order types</summary>${orders.map(o => `<div><span>${esc(o.purpose)}</span><strong>${money(o.amount)}</strong></div>`).join('')}</details>`
    : '<p>No standing orders are recorded for this account.</p>';

  const calendar = x.calendar || [];
  const peak = Math.max(1, ...calendar.filter(v => v !== null));
  const largest = calendar.indexOf(Math.max(...calendar.filter(v => v !== null)));
  $('#calendar-headline').textContent = largest < 0 ? 'Not enough history' : `${monthLabels[largest]} has the highest average outflow`;
  $('#calendar-detail').textContent = largest < 0 ? 'No monthly pattern available.' : `${money(calendar[largest])} in that calendar month on average, based on the available years.`;
  $('#money-calendar').innerHTML = calendar.map((v, i) => `<div class="calendar-col" title="${monthLabels[i]}: ${v === null ? 'No data' : money(v)}"><span style="height:${v === null ? 3 : Math.max(4, v / peak * 100)}%"></span><small>${monthLabels[i]}</small></div>`).join('');
}

function renderExtraShock() {
  const a = state.account, x = extraByAccount(), sc = scenario();
  $('#income-source').textContent = `Observed inflows: ${x.incomeSource || 'unclear'}`;
  $('#income-source-note').textContent = x.pensionMajority
    ? 'Pension led account. Bills and repairs are more relevant first steps than a job loss illustration.'
    : 'Income type is inferred from historical inflows. It is not verified employment income.';
  $$('.preset').forEach(node => node.style.order = x.pensionMajority
    ? ({bills:1, repair:2, job:3, combo:4})[node.dataset.preset]
    : ({job:1, bills:2, repair:3, combo:4})[node.dataset.preset]);
  $('#worst-month-title').textContent = `Worst month: ${x.worstMonth || 'unknown'}`;
  $('#worst-month-copy').textContent = `Spending was ${money(x.worstSpending || 0)}, or ${money(x.extraWorstSpending || 0)} above the typical month. Try that extra cost as a repair.`;
  $('#use-worst-month').disabled = !x.extraWorstSpending;
  const baseline = capRunway(runway(a.B, a.I, a.S));
  const riskPresets = [
    ['job', 'Job loss', runway(a.B, a.I * .55, a.S)],
    ['bills', 'Bills rise 15%', runway(a.B, a.I, a.S + a.H * .15)],
    ['repair', 'One month repair', runway(a.B, a.I, a.S, a.S)],
  ].map(([id, name, value]) => ({id, name, lost: Math.max(0, baseline - capRunway(value))})).sort((l,r) => r.lost - l.lost);
  const maxLost = Math.max(1, ...riskPresets.map(r => r.lost));
  $('#risk-rankings').innerHTML = riskPresets.map(r => `<button class="risk-row" data-risk-preset="${r.id}"><span><b>${esc(r.name)}</b><small>${r.lost.toFixed(1)} months less</small></span><i><em style="width:${r.lost / maxLost * 100}%"></em></i></button>`).join('');

  const low = x.lowIncome, high = x.highIncome;
  $$('#income-mode button').forEach(b => b.classList.toggle('active', b.dataset.incomeMode === extraUI.incomeMode));
  if (extraUI.incomeMode === 'typical') {
    $('#income-mode-description').textContent = `Official benchmark uses your typical ${money(a.I)} monthly inflows.`;
  } else {
    const selected = extraUI.incomeMode === 'low' ? low : high;
    const altRunway = runway(a.B, selected * state.shock.income / 100, sc.afterSpending, state.shock.repair);
    $('#income-mode-description').textContent = `A ${extraUI.incomeMode} month with ${money(selected)} of inflows would last ${runwayText(altRunway)} under these shock settings. Official result above still uses the median.`;
  }
  $('#shock-date').textContent = sc.value === null ? 'No modeled end date' : `Estimated buffer end: ${durationDate(sc.value)}`;
  setRunwayClass($('#shock-runway'), sc.value);
  $('#math-explanation').innerHTML = `
    <p>Typical money in (I) = ${money(a.I,2)}. Money out (S) = ${money(a.S,2)}. Household bills (H) = ${money(a.H,2)}.</p>
    <p>Shocked inflows = ${money(a.I,2)} × ${state.shock.income}% = ${money(sc.afterIncome,2)}.</p>
    <p>Shocked spending = ${money(a.S,2)} + ${money(a.H,2)} × ${state.shock.bills}% + ${money(state.shock.extra,2)} = ${money(sc.afterSpending,2)}.</p>
    <p>Buffer = ${money(a.B,2)} − ${money(state.shock.repair,2)} = ${money(sc.remaining,2)}. Monthly gap = ${money(sc.gap,2)}.</p>
    <p><strong>Official runway: ${runwayText(sc.value)}</strong>. If the gap is zero or less, the display is 120+ months. If buffer is exhausted, the value is zero.</p>`;
  const recovered = $('#recovered-bills');
  if (x.recoveredBills > 0) {
    recovered.hidden = false;
    recovered.innerHTML = `<strong>We also found ${money(x.recoveredBills)} of household standing orders.</strong><p>The benchmark labels household bills as $0 for this account, so the bill shock alone has no effect. You can add a separate 15% sensitivity test (${money(.15 * x.recoveredBills)}/month) without changing the official benchmark.</p><button id="add-recovered-bills" class="text-button">Try the extra monthly cost →</button>`;
  } else recovered.hidden = true;
  const duration = Number($('#ei-duration').value);
  $('#ei-duration-value').textContent = `${duration} months`;
  $('#ei-end-label').textContent = $('#ei-expiry').checked ? `Month ${duration}` : 'Not modeled';
  $('#ei-start-label').textContent = 'Month 1';
  let balance = sc.remaining, emptyMonth = balance <= 0 ? 0 : null;
  for (let m=1; m<=12 && emptyMonth === null; m++) {
    const income = $('#ei-expiry').checked && state.shock.income < 100 && m > duration ? 0 : sc.afterIncome;
    balance += income - sc.afterSpending;
    if (balance <= 0) emptyMonth = m;
  }
  $('#ei-zero-label').textContent = emptyMonth === null ? 'After 12 months / none' : emptyMonth === 0 ? 'Now' : `Month ${emptyMonth}`;
}

function renderExtraPlans() {
  const a=state.account, x=extraByAccount(), sc=scenario();
  const needed=Math.max(0, state.goalMonths*a.S - Math.max(0,a.B));
  const available=Math.max(0,a.I-a.S);
  const threeMonthGap=Math.max(0,3*a.S-Math.max(0,a.B));
  const group=threeMonthGap===0
    ? ['Safety net in place','Your buffer covers three months. Consider building toward six.']
    : available>0&&threeMonthGap/available<=12
      ? ['A reachable goal','At your current surplus, three months of spending is within about a year.']
      : available>0
        ? ['Build it in steps','A three month buffer takes longer than a year at the modeled surplus. Try smaller monthly transfers.']
        : ['Make room to save','Spending exceeds inflows. Start by improving your monthly cash flow before setting a savings date.'];
  $('#fund-group').innerHTML=`<strong>${group[0]}</strong><span>${group[1]}</span>`;
  $('#monthly-save-value').textContent=money(extraUI.monthlySave);
  $('#monthly-save').value=extraUI.monthlySave;
  $('#savings-date').textContent=needed===0
    ? 'Your modeled buffer already meets this goal.'
    : extraUI.monthlySave===0
      ? 'Choose an amount above $0 to see an estimated finish date.'
      : `At ${money(extraUI.monthlySave)} each month, you could reach this goal in about ${number(Math.ceil(needed/extraUI.monthlySave))} months (${durationDate(Math.ceil(needed/extraUI.monthlySave))}). ${extraUI.monthlySave>available?'This exceeds the current modeled surplus, so spending would first need to change.':''}`;
  $('#cut-monthly-value').textContent=money(extraUI.monthlyCut);
  $('#cut-monthly').value=extraUI.monthlyCut;
  const afterCut=runway(a.B,sc.afterIncome,sc.afterSpending-extraUI.monthlyCut,state.shock.repair);
  const before=capRunway(sc.value), after=capRunway(afterCut);
  $('#cut-payoff').innerHTML=`<strong>${durationDate(afterCut)}</strong><span>Buffer end if your monthly costs fall by ${money(extraUI.monthlyCut)}. That's ${Math.max(0,after-before).toFixed(1)} extra months in this model.</span>`;
  const pension=x.pensionMajority;
  const steps=[
    {id:'review',title:'Review upcoming automatic payments',detail:'Identify a bill date that could be moved. No savings assumed.'},
    {id:'cut',title:'Cut flexible spending by 10%',detail:`A modeled reduction of ${money(.1*Math.max(0,a.S-a.F))} per month, if feasible.`},
    {id:'income',title:pension?'Review pension and benefit payments':'Check eligibility and apply for EI promptly',detail:'No benefits assumed until eligibility is confirmed.'},
    {id:'contact',title:'Contact lenders before a missed payment',detail:'Discuss options. No payment reduction assumed.'},
  ];
  $('#backup-checklist').innerHTML=steps.map((s,i)=>`<label class="checklist-item"><input type="checkbox" data-checkstep="${s.id}" ${extraUI.checklist.has(s.id)?'checked':''}><span><strong>Week ${i===0?'1':i+1}: ${esc(s.title)}</strong><small>${esc(s.detail)}</small></span></label>`).join('');
  const checkCut=extraUI.checklist.has('cut') ? .1*Math.max(0,a.S-a.F) : 0;
  const changed=runway(a.B,sc.afterIncome,sc.afterSpending-checkCut,state.shock.repair);
  $('#checklist-effect').textContent=extraUI.checklist.has('cut')
    ? `If you can achieve the modeled cut, the buffer end shifts to ${durationDate(changed)}. Checking other steps doesn't assume benefits or payment relief.`
    : 'Check steps to plan your response. Only a specific spending cut changes the illustrated date.';
  renderLoanChecker();
}

function renderLoanChecker() {
  const a=state.account;
  const amount=Math.max(0,Number($('#loan-amount').value)||0);
  const months=Math.max(1,Number($('#loan-term').value)||1);
  const apr=Math.max(0,Number($('#loan-apr').value)||0);
  const rate=apr/1200;
  const payment=rate===0?amount/months:amount*rate/(1-Math.pow(1+rate,-months));
  const paymentPct=a.I>0?payment/a.I*100:null;
  const after=runway(a.B,a.I,a.S+payment);
  const current=runway(a.B,a.I,a.S);
  const risk=paymentPct===null?'Review carefully':paymentPct>=30||capRunway(after)<3?'High impact':paymentPct>=15||capRunway(after)<6?'Moderate impact':'Lower modeled impact';
  $('#loan-checker-result').innerHTML=`<div><span>Estimated monthly payment</span><strong>${money(payment)}</strong></div><div><span>Share of typical inflows</span><strong>${paymentPct===null?'N/A':percent(paymentPct)}</strong></div><div><span>Runway with new payment</span><strong>${runwayText(after)}</strong></div><div><span>Current benchmark runway</span><strong>${runwayText(current)}</strong></div><p class="loan-risk">${risk}. The payment is assumed to be additional monthly spending, not a statement about approval.</p>`;
}

function renderExtraInsights() {
  const cohorts=state.extras.cohorts || {};
  $('#quartile-discovery').innerHTML=`<div class="quartile-head"><span>Monthly inflows</span><span>Months saved</span><span>Under 6 mo</span></div>`+(cohorts.quartiles||[]).map((r,i)=>`<div class="quartile-row"><span>Q${i+1} · ${money(r.income)}</span><strong>${r.monthsSaved.toFixed(1)}</strong><b>${r.underSixPct.toFixed(1)}%</b></div>`).join('');
  const loan=cohorts.loanWarning || {preNegative:{n:0,defaulted:0},preNonnegative:{n:0,defaulted:0}};
  $('#loan-warning-discovery').innerHTML=`<strong>${loan.preNegative.defaulted} of ${loan.preNegative.n}</strong> borrowers with a recorded negative transaction before the loan later defaulted, compared with ${loan.preNonnegative.defaulted} of ${loan.preNonnegative.n} others. This is an observed sample, not a reliable predictor.`;
  const cliff=cohorts.eiCliff||{nSix:0,underNine:0,underTwelve:0};
  $('#ei-cliff-discovery').innerHTML=`Of ${number(cliff.nSix)} non pension majority accounts whose buffer lasts six months on the illustration, <strong>${cliff.nSix ? Math.round(cliff.underNine/cliff.nSix*100):0}%</strong> fall below zero by month 9 and <strong>${cliff.nSix ? Math.round(cliff.underTwelve/cliff.nSix*100):0}%</strong> by month 12 if modeled income then stops completely.`;
}

function renderExtras() {
  if (!state.account || !state.extras) return;
  renderExtraOverview();
  renderExtraShock();
  renderExtraPlans();
  renderExtraInsights();
}

function attachExtraEvents() {
  $('#use-worst-month').addEventListener('click',()=>{
    const amount=extraByAccount().extraWorstSpending||0;
    state.shock.repair=Math.round(amount/100)*100;
    state.shock.preset='custom';
    $('#repair-range').max=Math.max(Number($('#repair-range').max),Math.ceil(amount/1000)*1000);
    renderShock();renderPlans();
    toast('Your worst historical spending spike is applied');
  });
  $('#risk-rankings').addEventListener('click',e=>{
    const node=e.target.closest('[data-risk-preset]');
    if(node)applyPreset(node.dataset.riskPreset);
  });
  $('#income-mode').addEventListener('click',e=>{
    const b=e.target.closest('[data-income-mode]');
    if(b){extraUI.incomeMode=b.dataset.incomeMode;renderExtras();}
  });
  $('#recovered-bills').addEventListener('click',e=>{
    if(!e.target.closest('#add-recovered-bills'))return;
    state.shock.extra=Math.round(extraByAccount().recoveredBills*.15/50)*50;
    state.shock.preset='custom';renderShock();renderPlans();
  });
  $('#monthly-save').addEventListener('input',e=>{extraUI.monthlySave=Number(e.target.value);renderExtraPlans();});
  $('#cut-monthly').addEventListener('input',e=>{extraUI.monthlyCut=Number(e.target.value);renderExtraPlans();});
  $('#backup-checklist').addEventListener('change',e=>{
    if(!e.target.matches('[data-checkstep]'))return;
    if(e.target.checked)extraUI.checklist.add(e.target.dataset.checkstep);
    else extraUI.checklist.delete(e.target.dataset.checkstep);
    renderExtraPlans();
  });
  ['loan-amount','loan-term','loan-apr'].forEach(id=>$('#'+id).addEventListener('input',renderLoanChecker));
}
