// Us OS — Chris & Kat's 2-2-2 app. Local-first (localStorage); optional Claude
// idea generation via a browser-side Anthropic call, mirroring Home OS's ai.js.
// Vanilla ES modules, no build step — same stack as the rest of the Ortiz suite.

// ---------- tiny DOM helper ----------
function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const kid of [].concat(kids)) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : document.createTextNode(kid));
  return n;
}
const clear = (n) => { while (n.firstChild) n.removeChild(n.firstChild); return n; };

// ---------- store (localStorage) ----------
const KEY = 'ortiz-us-os';
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function save(data) { localStorage.setItem(KEY, JSON.stringify(data)); }
let DB = load();
DB.entries ||= [];   // logged/planned dates: {id,type,date,title,notes,rating,planned,updatedAt,deleted}
DB.ideas ||= [];     // idea backlog: {id,type,text,source,done,private,updatedAt,deleted}
DB.tickets ||= [];   // goal passes: {id,goal,kind,n,used,usedAt,note,updatedAt}
DB.settings ||= {};  // {apiKey,city,interests,theme,gistToken,gistId,lastSyncAt} — never synced
const now = () => new Date().toISOString();
// Deletes are tombstones (deleted:true + updatedAt) so a removal on one phone
// wins over the stale copy on the other; pruned after 60 days.
function pruneTombstones() {
  const cutoff = new Date(Date.now() - 60 * 86400000).toISOString();
  DB.entries = DB.entries.filter((r) => !(r.deleted && (r.updatedAt || '') < cutoff));
  DB.ideas = DB.ideas.filter((r) => !(r.deleted && (r.updatedAt || '') < cutoff));
}
const commit = () => { save(DB); scheduleSync(); };

// ---------- 2-2-2 model ----------
const CADENCES = [
  { type: 'date',    emoji: '💞', title: 'Date night',       cadence: 'every 2 weeks',   days: 14 },
  { type: 'getaway', emoji: '🧳', title: 'Weekend getaway',  cadence: 'every ~2 months', days: 61 },
  { type: 'trip',    emoji: '✈️', title: 'Destination trip', cadence: 'every ~2 years',  days: 730 },
];
const cadenceOf = (t) => CADENCES.find((c) => c.type === t);

// ---------- couple's goals ----------
const GOALS = [{
  id: 'dry-2027',
  emoji: '🥂',
  title: 'Alcohol-free stretch',
  sub: 'Through Jan 17, 2027 — with passes saved for the moments worth toasting.',
  ends: '2027-01-17',
  passes: [
    { kind: 'drink',  emoji: '🎟️', label: 'Drink tickets',         one: 'drink ticket',         count: 12 },
    { kind: 'escape', emoji: '🏖️', label: 'Weekend escape passes', one: 'weekend escape pass',  count: 3 },
  ],
}];
// Tickets get fixed ids (goal:kind:n) so both phones seed the identical set
// and merge per-ticket instead of doubling up. Seeds carry updatedAt:'' so a
// real tap on either phone always outranks the untouched seed in a merge.
function seedTickets() {
  const have = new Set(DB.tickets.map((t) => t.id));
  for (const g of GOALS) for (const p of g.passes) for (let n = 1; n <= p.count; n++) {
    const id = `${g.id}:${p.kind}:${n}`;
    if (!have.has(id)) DB.tickets.push({ id, goal: g.id, kind: p.kind, n, used: false, updatedAt: '' });
  }
}
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const parse = (s) => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate()+n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
function fmt(s) { return parse(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: parse(s).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }); }

// The most recent DONE (not future-planned) entry of a type.
function lastDone(type) {
  const t = todayStr();
  return DB.entries.filter((e) => !e.deleted && e.type === type && !e.planned && e.date <= t).sort((a,b) => a.date < b.date ? 1 : -1)[0] || null;
}
function nextPlanned(type) {
  const t = todayStr();
  return DB.entries.filter((e) => !e.deleted && e.type === type && (e.planned || e.date > t)).sort((a,b) => a.date < b.date ? -1 : 1)[0] || null;
}

// ---------- toast ----------
let toastTimer;
function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = el('div', { class: 'toast' }, msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2200);
}

// ---------- modal ----------
function modal(title, body, actions) {
  const scrim = el('div', { class: 'scrim', onclick: (e) => { if (e.target === scrim) close(); } });
  const sheet = el('div', { class: 'sheet' }, [el('h3', {}, title), ...body, el('div', { class: 'sheet-actions' }, actions)]);
  scrim.append(sheet);
  document.body.append(scrim);
  function close() { scrim.remove(); }
  return { close };
}

// ---------- views ----------
const view = document.getElementById('view');
let current = 'rhythm';
function render() {
  clear(view);
  if (current === 'rhythm') renderRhythm();
  else if (current === 'upnext') renderUpNext();
  else if (current === 'ideas') renderIdeas();
  else if (current === 'goals') renderGoals();
  else renderHistory();
}

// ---------- up next ----------
function renderUpNext() {
  view.append(el('h1', {}, 'Up next'), el('p', { class: 'sub' }, 'What you two get to look forward to.'));
  const t = todayStr();
  const upcoming = DB.entries.filter((e) => !e.deleted && (e.planned || e.date > t)).sort((a,b) => a.date < b.date ? -1 : 1);

  for (const e of upcoming) {
    const c = cadenceOf(e.type);
    const left = daysBetween(t, e.date);
    const when = left === 0 ? 'today!' : left === 1 ? 'tomorrow' : `in ${left} days`;
    view.append(el('div', { class: 'card next-card' }, [
      el('div', { class: 'card-top' }, [
        el('div', { class: 'card-emoji' }, c.emoji),
        el('div', {}, [
          el('div', { class: 'card-title' }, e.title || c.title),
          el('div', { class: 'card-cadence' }, `${c.title} · ${fmt(e.date)}${e.notes ? ' · ' + e.notes : ''}`),
        ]),
        el('div', { class: 'card-right' }, el('div', { class: 'countdown ' + (left <= 1 ? 'due' : 'ok') }, when)),
      ]),
    ]));
  }
  if (!upcoming.length) view.append(el('div', { class: 'empty' }, 'Nothing on the calendar yet — that just means it’s planning time 💞'));

  // Nudge for any cadence with nothing planned: anticipation needs a pipeline.
  const missing = CADENCES.filter((c) => !upcoming.some((e) => e.type === c.type));
  if (missing.length) {
    view.append(el('h2', {}, 'Needs a plan'));
    for (const c of missing) view.append(el('div', { class: 'row' }, [
      el('span', { class: 'r-emoji' }, c.emoji),
      el('div', { class: 'r-main' }, [el('div', { class: 'r-title' }, c.title), el('div', { class: 'r-meta' }, `nothing planned · ${c.cadence}`)]),
      el('div', { class: 'r-actions' }, [
        el('button', { class: 'btn btn-sm', onclick: () => logModal(c.type, { planned: true }) }, '＋ Plan'),
        el('button', { class: 'btn btn-ghost btn-sm', onclick: () => { current = 'ideas'; ideaFilter = c.type; setTab(); render(); } }, '💡'),
      ]),
    ]));
  }
}

// ---------- couple's goals ----------
function renderGoals() {
  view.append(el('h1', {}, 'Couple’s goals'), el('p', { class: 'sub' }, 'Shared commitments — with grace built in.'));
  const t = todayStr();
  for (const g of GOALS) {
    const left = daysBetween(t, g.ends);
    const kids = [
      el('div', { class: 'card-top' }, [
        el('div', { class: 'card-emoji' }, g.emoji),
        el('div', {}, [el('div', { class: 'card-title' }, g.title), el('div', { class: 'card-cadence' }, g.sub)]),
        el('div', { class: 'card-right' }, el('div', { class: 'countdown ' + (left < 0 ? 'due' : 'ok') }, left < 0 ? 'done!' : `${left}d left`)),
      ]),
    ];
    for (const p of g.passes) {
      const tix = DB.tickets.filter((x) => x.goal === g.id && x.kind === p.kind).sort((a,b) => a.n - b.n);
      const remaining = tix.filter((x) => !x.used).length;
      kids.push(el('div', { class: 'pass-head' }, [
        el('span', {}, `${p.emoji} ${p.label}`),
        el('span', { class: 'chip' + (remaining ? ' love' : '') }, `${remaining} of ${tix.length} left`),
      ]));
      kids.push(el('div', { class: 'tickets' }, tix.map((x) =>
        el('button', {
          class: 'ticket' + (x.used ? ' used' : ''),
          title: x.used ? `Used ${x.usedAt ? fmt(x.usedAt) : ''}${x.note ? ' · ' + x.note : ''}` : `${p.one} #${x.n}`,
          onclick: () => ticketModal(x, p),
        }, [el('span', { class: 't-emoji' }, p.emoji), el('span', { class: 't-n' }, x.used ? '✓' : x.n)])
      )));
    }
    view.append(el('div', { class: 'card' }, kids));
  }
}

function ticketModal(x, p) {
  const one = p.one;
  if (x.used) {
    const m = modal(`${p.emoji} Used ${one}`, [
      el('p', { class: 'muted' }, `${x.usedAt ? fmt(x.usedAt) : 'Date unknown'}${x.note ? ' — ' + x.note : ''}`),
    ], [
      el('button', { class: 'btn', onclick: () => m.close() }, 'Close'),
      el('button', { class: 'btn btn-primary', onclick: () => {
        x.used = false; x.usedAt = null; x.note = ''; x.updatedAt = now();
        commit(); m.close(); toast('Ticket returned 🎟️'); render();
      } }, 'Give it back'),
    ]);
    return;
  }
  const date = el('input', { class: 'input', type: 'date', value: todayStr() });
  const note = el('input', { class: 'input', placeholder: 'What’s the occasion? (optional)' });
  const m = modal(`${p.emoji} Use a ${one}?`, [
    el('label', { class: 'field-label' }, 'When'), date,
    el('label', { class: 'field-label' }, 'Occasion'), note,
  ], [
    el('button', { class: 'btn', onclick: () => m.close() }, 'Not yet'),
    el('button', { class: 'btn btn-primary', onclick: () => {
      x.used = true; x.usedAt = date.value || todayStr(); x.note = note.value.trim(); x.updatedAt = now();
      commit(); m.close(); toast('Enjoy it — you earned it 🥂'); render();
    } }, 'Use it'),
  ]);
  note.focus();
}

function renderRhythm() {
  view.append(el('h1', {}, 'Your rhythm'), el('p', { class: 'sub' }, 'The 2-2-2 you two live by — kept on pace.'));
  for (const c of CADENCES) {
    const last = lastDone(c.type);
    const planned = nextPlanned(c.type);
    const due = last ? addDays(last.date, c.days) : todayStr();
    const left = daysBetween(todayStr(), due);
    const pct = last ? Math.min(100, Math.max(0, Math.round((c.days - left) / c.days * 100))) : 100;
    const over = left < 0;

    const countdown = planned
      ? el('div', { class: 'countdown ok' }, 'planned')
      : el('div', { class: 'countdown ' + (left <= 0 ? 'due' : left <= Math.ceil(c.days*0.15) ? 'due' : 'ok') },
          !last ? 'let’s start' : over ? `${-left}d over` : left === 0 ? 'today' : `${left}d`);

    const meta = planned
      ? `${cadenceOf(c.type).emoji ? '' : ''}${planned.title || 'Something planned'} · ${fmt(planned.date)}`
      : last ? `last: ${last.title ? last.title + ' · ' : ''}${fmt(last.date)}` : 'no history yet';

    view.append(el('div', { class: 'card' }, [
      el('div', { class: 'card-top' }, [
        el('div', { class: 'card-emoji' }, c.emoji),
        el('div', {}, [el('div', { class: 'card-title' }, c.title), el('div', { class: 'card-cadence' }, c.cadence)]),
        el('div', { class: 'card-right' }, [countdown, el('div', { class: 'card-meta' }, meta)]),
      ]),
      el('div', { class: 'bar' + (over ? ' over' : '') }, el('span', { style: `width:${pct}%` })),
      el('div', { class: 'card-actions' }, [
        el('button', { class: 'btn btn-primary btn-sm', onclick: () => logModal(c.type) }, '✓ Log one'),
        el('button', { class: 'btn btn-sm', onclick: () => logModal(c.type, { planned: true }) }, '＋ Plan ahead'),
        el('button', { class: 'btn btn-ghost btn-sm', onclick: () => { current = 'ideas'; ideaFilter = c.type; setTab(); render(); } }, '💡 Ideas'),
      ]),
    ]));
  }
}

let ideaFilter = 'all';
let privateMode = false; // add-box lock: new ideas stay on this device, never sync
function renderIdeas() {
  view.append(el('h1', {}, 'Ideas'), el('p', { class: 'sub' }, 'A running list for when it’s time to plan.'));

  const seg = el('div', { class: 'seg' }, [
    ['all', 'All'], ...CADENCES.map((c) => [c.type, `${c.emoji} ${c.title.split(' ')[0]}`]), ['private', '🔒 Private'],
  ].map(([v, label]) => el('button', { class: ideaFilter === v ? 'active' : '', onclick: () => { ideaFilter = v; render(); } }, label)));
  view.append(seg);
  if (ideaFilter === 'private') view.append(el('p', { class: 'muted small', style: 'margin: -6px 0 12px' }, 'Your eyes only — these live on this device and never sync.'));

  const addType = (ideaFilter === 'all' || ideaFilter === 'private') ? 'date' : ideaFilter;
  const inp = el('input', { class: 'input', placeholder: `Add a ${privateMode ? 'private ' : ''}${cadenceOf(addType).title.toLowerCase()} idea…`, onkeydown: (e) => { if (e.key === 'Enter') addIdea(); } });
  // Private mode: for surprises. A locked idea lives ONLY on this device —
  // it's excluded from the sync payload, so the other phone never sees it.
  const lockBtn = el('button', {
    class: 'btn' + (privateMode ? ' btn-primary' : ''),
    title: privateMode ? 'Private mode ON — new ideas stay on this device only' : 'Switch to private mode (ideas never sync — for surprises)',
    'aria-label': 'Toggle private mode',
    onclick: () => { privateMode = !privateMode; render(); },
  }, privateMode ? '🔒' : '🔓');
  function addIdea() {
    const text = inp.value.trim(); if (!text) return;
    DB.ideas.unshift({ id: uid(), type: addType, text, source: 'you', done: false, private: privateMode, updatedAt: now() }); commit();
    inp.value = ''; render();
  }
  view.append(el('div', { class: 'addbox' }, [lockBtn, inp, el('button', { class: 'btn btn-primary', onclick: addIdea }, 'Add')]));
  if (privateMode) view.append(el('p', { class: 'muted small', style: 'margin: -8px 0 14px' }, '🔒 Private mode — new ideas (including Claude’s) stay on this device and never sync. Perfect for surprises.'));

  if (hasKey()) {
    const genBtn = el('button', { class: 'btn btn-sm', onclick: () => generateIdeas(addType, genBtn) }, `✨ Claude, suggest a few${privateMode ? ' (privately)' : ''}`);
    view.append(el('div', { style: 'margin: -6px 0 14px' }, genBtn));
  }

  const list = DB.ideas
    .filter((i) => !i.deleted && (ideaFilter === 'all' || (ideaFilter === 'private' ? i.private : i.type === ideaFilter)))
    .sort((a, b) => ((b.updatedAt || '') < (a.updatedAt || '') ? -1 : 1));
  if (!list.length) { view.append(el('div', { class: 'empty' }, 'No ideas here yet — jot one above, or let Claude riff.')); return; }

  for (const idea of list) {
    const c = cadenceOf(idea.type);
    view.append(el('div', { class: 'row' + (idea.done ? ' done' : '') }, [
      el('span', { class: 'r-emoji' }, idea.private ? '🔒' : c.emoji),
      el('div', { class: 'r-main' }, [
        el('div', { class: 'r-title' }, idea.text),
        el('div', { class: 'r-meta' }, `${c.title}${idea.source === 'claude' ? ' · from Claude' : ''}${idea.private ? ' · private, this device only' : ''}`),
      ]),
      el('div', { class: 'r-actions' }, [
        el('button', { class: 'btn btn-sm', title: 'Plan this', onclick: () => logModal(idea.type, { planned: true, prefill: idea.text, ideaId: idea.id }) }, 'Plan'),
        el('button', { class: 'btn btn-ghost btn-sm', title: 'Delete', onclick: () => { idea.deleted = true; idea.updatedAt = now(); commit(); render(); } }, '✕'),
      ]),
    ]));
  }
}

function renderHistory() {
  view.append(el('h1', {}, 'History'), el('p', { class: 'sub' }, 'Everything you’ve shared, most recent first.'));
  const t = todayStr();
  const done = DB.entries.filter((e) => !e.deleted && !e.planned && e.date <= t).sort((a,b) => a.date < b.date ? 1 : -1);
  const upcoming = DB.entries.filter((e) => !e.deleted && (e.planned || e.date > t)).sort((a,b) => a.date < b.date ? -1 : 1);

  if (upcoming.length) {
    view.append(el('h2', {}, 'Coming up'));
    for (const e of upcoming) view.append(historyRow(e, true));
  }
  view.append(el('h2', {}, 'Been there'));
  if (!done.length) view.append(el('div', { class: 'empty' }, 'Log your first one from the Rhythm tab.'));
  for (const e of done) view.append(historyRow(e, false));
}
function historyRow(e, upcoming) {
  const c = cadenceOf(e.type);
  return el('div', { class: 'row' }, [
    el('span', { class: 'r-emoji' }, c.emoji),
    el('div', { class: 'r-main' }, [
      el('div', { class: 'r-title' }, e.title || c.title),
      el('div', { class: 'r-meta' }, `${fmt(e.date)}${e.notes ? ' · ' + e.notes : ''}`),
    ]),
    e.rating ? el('span', { class: 'chip love' }, '♥'.repeat(e.rating)) : (upcoming ? el('span', { class: 'chip' }, 'planned') : null),
    el('button', { class: 'btn btn-ghost btn-sm', onclick: () => { e.deleted = true; e.updatedAt = now(); commit(); render(); } }, '✕'),
  ]);
}

// ---------- log / plan modal ----------
function logModal(type, { planned = false, prefill = '', ideaId = null } = {}) {
  const c = cadenceOf(type);
  const title = el('input', { class: 'input', placeholder: 'What did you do? (optional)', value: prefill });
  const date = el('input', { class: 'input', type: 'date', value: planned ? addDays(todayStr(), 14) : todayStr() });
  const notes = el('input', { class: 'input', placeholder: 'A note to remember it by (optional)' });
  let rating = 0;
  const stars = [1,2,3,4,5].map((n) => el('button', { onclick: () => { rating = rating === n ? 0 : n; stars.forEach((s,i) => s.classList.toggle('on', i < rating)); } }, '♥'));
  const ratingRow = el('div', {}, [el('label', { class: 'field-label' }, 'How was it?'), el('div', { class: 'rating' }, stars)]);

  const body = [
    el('label', { class: 'field-label' }, planned ? 'Planned date' : 'Date'), date,
    el('label', { class: 'field-label' }, c.title), title,
    el('label', { class: 'field-label' }, 'Notes'), notes,
  ];
  if (!planned) body.push(ratingRow);

  const m = modal(planned ? `Plan a ${c.title.toLowerCase()}` : `Log a ${c.title.toLowerCase()}`, body, [
    el('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'),
    el('button', { class: 'btn btn-primary', onclick: () => {
      DB.entries.push({ id: uid(), type, date: date.value || todayStr(), title: title.value.trim(), notes: notes.value.trim(), rating, planned, updatedAt: now() });
      if (ideaId) { const it = DB.ideas.find((x) => x.id === ideaId); if (it) { it.done = true; it.updatedAt = now(); } }
      commit(); m.close();
      toast(planned ? 'Added to Coming up 💞' : 'Logged — nice 💞');
      render();
    } }, planned ? 'Plan it' : 'Log it'),
  ]);
  title.focus();
}

// ---------- settings ----------
function settingsModal() {
  const s = DB.settings;
  const apiKey = el('input', { class: 'input', type: 'password', placeholder: 'sk-ant-…', value: s.apiKey || '' });
  const city = el('input', { class: 'input', placeholder: 'e.g. Phoenix, AZ', value: s.city || '' });
  const interests = el('input', { class: 'input', placeholder: 'e.g. live music, tacos, hiking, comedy', value: s.interests || '' });
  const themeSel = el('select', { class: 'input' }, ['auto','light','dark'].map((v) => el('option', { value: v, selected: (s.theme||'auto')===v ? 'selected' : null }, v[0].toUpperCase()+v.slice(1))));
  const gistToken = el('input', { class: 'input', type: 'password', placeholder: 'GitHub token (gist scope)', value: s.gistToken || '' });
  const gistId = el('input', { class: 'input', placeholder: 'Gist ID', value: s.gistId || '' });
  const syncLine = el('p', { class: 'muted small', style: 'margin:6px 0 0' },
    s.gistToken && s.gistId ? `Sync configured${s.lastSyncAt ? ' · last synced ' + new Date(s.lastSyncAt).toLocaleString() : ''}` : 'Same setup as Home OS: both phones use the same private Gist + token. 🔒 Private ideas never leave this device.');

  const m = modal('Settings', [
    el('label', { class: 'field-label' }, 'Home city (sharpens ideas)'), city,
    el('label', { class: 'field-label' }, 'What you two enjoy'), interests,
    el('label', { class: 'field-label' }, 'Claude API key (optional — for ✨ idea suggestions)'), apiKey,
    el('p', { class: 'muted small', style: 'margin:6px 0 0' }, 'Kept on this device only. Get one at console.anthropic.com.'),
    el('label', { class: 'field-label' }, 'Shared sync (optional — private Gist)'), gistToken, el('div', { style: 'height:8px' }), gistId,
    syncLine,
    el('div', { style: 'margin-top:10px' }, el('button', { class: 'btn btn-sm', onclick: () => syncNow(true) }, '⇅ Sync now')),
    el('label', { class: 'field-label' }, 'Appearance'), themeSel,
  ], [
    el('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'),
    el('button', { class: 'btn btn-primary', onclick: () => {
      DB.settings = { ...s, apiKey: apiKey.value.trim(), city: city.value.trim(), interests: interests.value.trim(), theme: themeSel.value, gistToken: gistToken.value.trim(), gistId: gistId.value.trim() };
      commit(); applyTheme(); m.close(); toast('Saved'); render();
    } }, 'Save'),
  ]);
}
const hasKey = () => Boolean(DB.settings.apiKey);

// ---------- gist sync (shared with Kat; same model as Home OS) ----------
// One private Gist, one JSON file; both phones merge per-record by id,
// newest updatedAt wins; tombstones keep deletions deleted. PRIVATE ideas
// are stripped from the payload before it ever leaves the device.
const GIST_FILE = 'ortiz-us-os.json';
function sharedPayload() {
  return { entries: DB.entries, ideas: DB.ideas.filter((i) => !i.private), tickets: DB.tickets, savedAt: now() };
}
function mergeCol(local, remote) {
  const byId = new Map(local.map((r) => [r.id, r]));
  for (const r of remote || []) {
    const l = byId.get(r.id);
    if (!l || (r.updatedAt || '') > (l.updatedAt || '')) byId.set(r.id, { ...r });
  }
  return [...byId.values()];
}
const syncConfigured = () => Boolean(DB.settings.gistToken && DB.settings.gistId);
let syncTimer = null, syncing = false;
function scheduleSync() {
  if (!syncConfigured()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(false), 2000);
}
async function syncNow(manual) {
  if (!syncConfigured() || syncing) { if (manual && !syncConfigured()) toast('Add a Gist token + ID first'); return; }
  syncing = true;
  const headers = { Authorization: 'Bearer ' + DB.settings.gistToken, Accept: 'application/vnd.github+json' };
  try {
    const res = await fetch(`https://api.github.com/gists/${DB.settings.gistId}`, { headers });
    if (!res.ok) throw new Error('GitHub ' + res.status);
    const raw = (await res.json()).files?.[GIST_FILE]?.content;
    if (raw) {
      const remote = JSON.parse(raw);
      DB.entries = mergeCol(DB.entries, remote.entries);
      // Remote never contains private ideas, so local 🔒 ones pass through untouched.
      DB.ideas = mergeCol(DB.ideas, remote.ideas);
      DB.tickets = mergeCol(DB.tickets, remote.tickets);
      pruneTombstones();
      save(DB);
    }
    const patch = await fetch(`https://api.github.com/gists/${DB.settings.gistId}`, {
      method: 'PATCH', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(sharedPayload()) } } }),
    });
    if (!patch.ok) throw new Error('GitHub ' + patch.status);
    DB.settings.lastSyncAt = now(); save(DB);
    if (manual) toast('Synced ✓');
    if (!document.querySelector('.scrim')) render(); // don't stomp an open sheet
  } catch (err) {
    if (manual) toast('Sync failed: ' + err.message);
  } finally { syncing = false; }
}
// Debug/verification hook (harmless in production, handy on device too).
window.__us = { sharedPayload, mergeCol };

// ---------- Claude idea generation (browser-side, like Home OS) ----------
async function generateIdeas(type, btn) {
  const c = cadenceOf(type);
  btn.disabled = true; const label = btn.textContent; btn.innerHTML = '<span class="spinner"></span> thinking…';
  try {
    const s = DB.settings;
    const existing = DB.ideas.filter((i) => i.type === type).map((i) => i.text).join('; ');
    const month = new Date().toLocaleDateString('en-US', { month: 'long' });
    const prompt = `You help a married couple, Chris & Kat, keep their relationship playful. Suggest 4 specific, doable ${c.title.toLowerCase()} ideas (${c.cadence}).`
      + (s.city ? ` They live in ${s.city} — name real venues, neighborhoods, and destinations near there, the kind of thing locals actually do.` : '')
      + ` It's ${month}, so lean seasonal (weather, festivals-season, that time of year).`
      + (s.interests ? ` They enjoy: ${s.interests}.` : '')
      + (existing ? ` Avoid repeating these they already have: ${existing}.` : '')
      + ` Don't invent specific event dates or claim something is happening on a particular day — suggest places and experiences, not calendar listings.`
      + ` Return ONLY a JSON array of 4 short strings (each a single idea, no numbering). No prose.`;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': s.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 500, thinking: { type: 'disabled' }, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}`);
    const json = await res.json();
    const text = (json.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    const arr = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1));
    let added = 0;
    for (const idea of arr) { if (typeof idea === 'string' && idea.trim()) { DB.ideas.unshift({ id: uid(), type, text: idea.trim(), source: 'claude', done: false, private: privateMode, updatedAt: now() }); added++; } }
    commit(); toast(`Added ${added}${privateMode ? ' private' : ''} idea${added===1?'':'s'} ✨`); render();
  } catch (err) {
    toast('Idea fetch failed: ' + err.message);
    btn.disabled = false; btn.textContent = label;
  }
}

// ---------- theme + tabs + boot ----------
function applyTheme() {
  const pref = DB.settings.theme || 'auto';
  if (pref === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', pref);
}
function setTab() {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === current));
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { current = t.dataset.tab; if (current !== 'ideas') ideaFilter = 'all'; setTab(); render(); }));
document.getElementById('settings-btn').addEventListener('click', settingsModal);

applyTheme();
pruneTombstones();
seedTickets();
render();
syncNow(false); // pull the other phone's changes on open
// Coming back to the app (phone unlock, tab switch) is the natural moment
// the other phone's changes matter — re-sync quietly.
document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleSync(); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
