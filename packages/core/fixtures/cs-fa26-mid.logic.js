
(() => {
  const D = JSON.parse(document.getElementById('data').textContent);
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const DAYS = [
    ['2026-11-02', 'Mon', 2, 'mon'], ['2026-11-03', 'Tue', 3, 'tue'], ['2026-11-04', 'Wed', 4, 'wed'], ['2026-11-05', 'Thu', 5, 'thu'],
    ['2026-11-06', 'Fri', 6, 'fri'], ['2026-11-07', 'Sat', 7, 'sat'], ['2026-11-08', 'Sun', 8, null], ['2026-11-09', 'Mon', 9, 'mon9']];
  const FULL = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };
  const dayOf = (iso) => DAYS.find((x) => x[0] === iso);
  const cvar = (k) => `--c:var(--${k});--t:var(--${k}-t)`;
  const t12 = (t) => { let [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')} ${ap}`; };
  const B = (x) => parseInt(x, 36);
  const byKey = new Map();
  for (const [pre, str] of Object.entries(D.groups)) for (const row of str.split(';')) { const r = row.split('|'); byKey.set(`${pre}-${r[0]}`, r); }
  function decode(enc, home) {
    const out = []; let i = 0;
    while (i < enc.length) {
      const sl = B(enc[i]), kd = B(enc.substr(i + 1, 2)), rm = B(enc[i + 3]); i += 4;
      let seat;
      if (enc[i] === '~') { seat = D.special[B(enc.substr(i + 1, 2))]; i += 3; }
      else { seat = `R${B(enc[i])}-${B(enc[i + 1])}`; i += 2; }
      let cl = home;
      if (enc[i] === '.') { cl = B(enc.substr(i + 1, 2)); i += 3; }
      out.push([sl, kd, cl, rm, seat]);
    }
    return out;
  }
  const KEY = 'cs-fa26-mid-student';
  const store = { get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} } };

  $('#meta').innerHTML = `<span><b>2–9</b> November 2026</span><span><b>${D.totals.students.toLocaleString('en')}</b> students</span><span><b>${D.totals.seats.toLocaleString('en')}</b> seats</span><span>Updated <b>${esc(D.stamp)}</b></span>`;
  $('#foot').innerHTML = `Department of Computer Science · from the Final Date Sheet and Seating Plan of ${esc(D.stamp)}. If a course you are registered in is missing, contact the CS UG Program Office.`;

  function normReg(v) {
    const x = v.toUpperCase().replace(/CIIT\//, '').replace(/\/ISB/, '').replace(/\s+/g, '');
    const m = x.match(/^([A-Z]{2})-?(\d{2})-?([A-Z]{3})-?(\d{1,3})$/);
    return m ? `${m[1]}${m[2]}-${m[3]}-${m[4].padStart(3, '0')}` : null;
  }

  /* ---------- student view ---------- */
  function seatInfo(room, seat) {
    const cr = seat.match(/^CR-(\d+) (\w+) (\d\d:\d\d)-(\d\d:\d\d)$/);
    if (cr) return { cr: true, seat: 'CR-' + cr[1], order: cr[2], a: cr[3], b: cr[4] };
    const ex = seat.match(/^Extra-(\d+)$/);
    if (ex) return { seat: `Extra chair ${ex[1]}`, note: 'A labelled extra chair in this room' };
    const r = seat.match(/^R(\d+)-(\d+)$/);
    if (r) return { seat, note: `Row ${r[1]} from the front, seat ${r[2]} from the left` };
    return { seat };
  }
  function renderStudent(key, st) {
    const [, name, hc, enc] = st; const home = B(hc);
    const papers = decode(enc, home).map(([sl, kd, cl, rm, seat]) => { const [dt, a, b] = D.slots[sl]; const [code, title, teacher] = D.kinds[kd]; return { dt, a, b, code, title, teacher: teacher || '', cls: D.cls[cl], room: D.rooms[rm], ...seatInfo(D.rooms[rm], seat) }; });
    papers.sort((x, y) => (x.dt + x.a).localeCompare(y.dt + y.a));
    const tba = (D.tba && D.tba[key]) || [];
    const tbaSlips = tba.map(([code, title, tch]) => `<article class="slip"><div class="stub"><span class="dw">Date</span><span class="tm">TBA</span></div><div class="paper"><div class="ph"><div><h3><span class="code">${esc(code)}</span>${esc(title)}</h3><div class="secline">Teacher: <b>${esc(tch)}</b></div></div></div><div class="crbox">Date sheet yet to be announced. You will be informed of the date, time and room of this paper.</div></div></article>`).join('');
    if (!papers.length) {
      $('#mine').innerHTML = `<div class="who"><h2>${esc(name)}</h2><div class="idline"><span>Registration <b>${esc(key)}</b></span><span>Class <b>${esc(D.cls[home])}</b></span></div>
        <div class="facts"><span class="fact"><b>${tba.length}</b>paper${tba.length > 1 ? 's' : ''} to be announced</span></div></div><div class="slips">${tbaSlips}</div>`;
      return;
    }
    const days = [...new Set(papers.map((p) => p.dt))];
    const first = papers[0], fd = dayOf(first.dt);
    const week = DAYS.map(([iso, dw, dn, k]) => {
      if (!k) return `<div class="day off"><span class="dw">${dw}</span><span class="dn">${dn}</span><span class="dc">Off</span></div>`;
      const n = papers.filter((p) => p.dt === iso).length;
      return n ? `<div class="day on" style="${cvar(k)}"><span class="dw">${dw}</span><span class="dn">${dn}</span><span class="dc">${n} paper${n > 1 ? 's' : ''}</span></div>`
               : `<div class="day"><span class="dw">${dw}</span><span class="dn">${dn}</span><span class="dc">—</span></div>`;
    }).join('');
    const homeCls = D.cls[home];
    const slips = papers.map((p) => {
      const [, dw, dn, k] = dayOf(p.dt);
      const hyb = p.a === '08:30' && p.b === '10:00' ? '<span class="tag">Hybrid · 90 min</span>' : '';
      const where = p.cr
        ? `<div class="seatrow"><div class="seatbox cr"><span>Room</span><b>CL-10</b><small>Clash Room</small></div><div class="seatbox cr"><span>Seat</span><b>${esc(p.seat)}</b><small>${p.order === '1st' ? 'First' : p.order === '2nd' ? 'Second' : 'Third'} paper, ${t12(p.a)} to ${t12(p.b)}</small></div></div>
           <div class="crbox">You have two papers at the same time. You will sit both in the Clash Room (CL-10), one after the other, and stay until both are finished.</div>`
        : `<div class="seatrow"><div class="seatbox"><span>Room</span><b>${esc(p.room)}</b></div><div class="seatbox"><span>Seat</span><b>${esc(p.seat)}</b>${p.note ? `<small>${esc(p.note)}</small>` : ''}</div></div>`;
      return `<article class="slip" style="${cvar(k)}">
        <div class="stub"><span class="dw">${FULL[dw]}</span><span class="dn">${dn}</span><span class="mo">November</span><span class="tm">${t12(p.a)}</span><span class="to">to ${t12(p.b)}</span></div>
        <div class="paper">
          <div class="ph"><div><h3><span class="code">${esc(p.code)}</span>${esc(p.title)}${hyb}</h3>${p.teacher ? `<div class="secline">Teacher: <b>${esc(p.teacher)}</b></div>` : ''}${p.cls !== homeCls ? `<div class="secline">With section ${esc(p.cls)}</div>` : ''}</div></div>
          ${where}
        </div></article>`;
    }).join('');
    const nCR = papers.filter((p) => p.cr).length;
    $('#mine').innerHTML = `<div class="who">
        <h2>${esc(name)}</h2>
        <div class="idline"><span>Registration <b>${esc(key)}</b></span><span>Class <b>${esc(homeCls)}</b></span></div>
        <div class="facts">
          <span class="fact"><b>${papers.length}</b>paper${papers.length > 1 ? 's' : ''}</span>
          <span class="fact"><b>${days.length}</b>exam day${days.length > 1 ? 's' : ''}</span>
          <span class="fact">First paper <b style="font-size:14px">${fd[1]} ${fd[2]} Nov, ${t12(first.a)}</b></span>
          ${nCR ? `<span class="fact"><b>${nCR}</b>in Clash Room</span>` : ''}
        </div>
        <div class="week" aria-label="Your exam days">${week}</div>
      </div>
      <div class="slips">${slips}${tbaSlips}</div>
      <ul class="notes">
        <li>Seat R3-5 means row 3 from the front of the room, seat 5 from the left.</li>
        <li>Papers are 80 minutes; hybrid (Virtual Campus) papers are 90 minutes.</li>
        <li>If a course you are registered in is missing here, contact the CS UG Program Office before the exams.</li>
      </ul>`;
  }
  function prompt(msg) {
    $('#mine').innerHTML = `${msg ? `<div class="err" style="margin-top:12px">${msg}</div>` : ''}<div class="prompt"><b>See your papers, room and seat.</b> Type your registration number in the box above, for example <b>FA24-BSE-058</b>, and press Show. Your papers, rooms and seat numbers appear here.<br><br>Want the whole timetable of your class? Open <b>Class date sheet</b>.</div>`;
  }
  function lookup() {
    const raw = $('#q').value.trim(); if (!raw) { prompt(); return; }
    const k = normReg(raw);
    const st = k && byKey.get(k);
    setTab('mine');
    if (!st) { prompt(k ? `No exam seats found for ${esc(k)}. Please check the number. If it is correct, contact the CS UG Program Office.` : `“${esc(raw)}” is not a registration number. Type it like FA24-BSE-058.`); return; }
    $('#q').value = k; store.set(k); renderStudent(k, st); $('#q').blur();
    $('#mine').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('#go').addEventListener('click', lookup);
  $('#q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); lookup(); } });

  /* ---------- class view ---------- */
  const sel = $('#cls');
  sel.innerHTML = D.classes.map(([c], i) => `<option value="${i}">${esc(c)}</option>`).join('');
  function renderClass(i) {
    const [c, rows] = D.classes[i];
    const byDay = {};
    rows.forEach((r) => { const [dt] = D.slots[r[0]]; (byDay[dt] = byDay[dt] || []).push(r); });
    const week = DAYS.map(([iso, dw, dn, k]) => {
      if (!k) return `<div class="day off"><span class="dw">${dw}</span><span class="dn">${dn}</span><span class="dc">Off</span></div>`;
      const n = (byDay[iso] || []).length;
      return n ? `<div class="day on" style="${cvar(k)}"><span class="dw">${dw}</span><span class="dn">${dn}</span><span class="dc">${n} paper${n > 1 ? 's' : ''}</span></div>`
               : `<div class="day"><span class="dw">${dw}</span><span class="dn">${dn}</span><span class="dc">Free</span></div>`;
    }).join('');
    const slips = rows.map(([sl, kd, teacher, rooms]) => {
      const [dt, a, b] = D.slots[sl]; const [, dw, dn, k] = dayOf(dt);
      const hyb = a === '08:30' && b === '10:00' ? '<span class="tag">Hybrid · 90 min</span>' : '';
      return `<article class="slip" style="${cvar(k)}">
        <div class="stub"><span class="dw">${FULL[dw]}</span><span class="dn">${dn}</span><span class="mo">November</span><span class="tm">${t12(a)}</span><span class="to">to ${t12(b)}</span></div>
        <div class="paper"><div class="ph"><div><h3><span class="code">${esc(D.kinds[kd][0])}</span>${esc(D.kinds[kd][1])}${hyb}</h3></div></div>
          <div class="teach">Teacher <b>${esc(teacher)}</b></div>
          <dl class="kv"><dt>Rooms</dt><dd>${rooms.map((r) => `<span class="pill room">${esc(D.rooms[r])}</span>`).join('') || '—'}</dd></dl>
        </div></article>`;
    }).join('');
    $('#clsbody').innerHTML = `<div class="who"><h2>${esc(c)}</h2>
        <div class="facts"><span class="fact"><b>${rows.length}</b>papers</span><span class="fact"><b>${Object.keys(byDay).length}</b>exam days</span></div>
        <div class="week">${week}</div></div>
      <div class="slips">${slips}</div>
      <ul class="notes"><li>These are the papers of the whole class. Your own room and seat: search your registration number above.</li>
      <li>Students taking a course with another section sit that section's paper; search your registration number to see all of yours.</li></ul>`;
  }
  sel.addEventListener('change', () => renderClass(+sel.value));

  /* ---------- tabs ---------- */
  function setTab(which) {
    const mine = which === 'mine';
    $('#tab-mine').setAttribute('aria-selected', mine); $('#tab-cls').setAttribute('aria-selected', !mine);
    $('#mine').hidden = !mine; $('#clsview').hidden = mine;
  }
  $('#tab-mine').addEventListener('click', () => setTab('mine'));
  $('#tab-cls').addEventListener('click', () => setTab('cls'));

  renderClass(0);
  const saved = store.get();
  if (saved && byKey.get(saved)) { $('#q').value = saved; renderStudent(saved, byKey.get(saved)); }
  else prompt();
})();
