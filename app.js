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
DB.bingo ||= [];     // easter-egg bingo squares: {id,n,done,updatedAt}
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

// ---------- special dates ----------
const SPECIAL = [
  { emoji: '💍', label: 'Anniversary', month: 9, day: 12, since: 2013 },
  { emoji: '🎂', label: 'Chris', month: 2, day: 26 },
  { emoji: '🎂', label: 'Kat', month: 8, day: 15 },
];
function nextSpecial(s) {
  const t = parse(todayStr());
  let d = new Date(t.getFullYear(), s.month - 1, s.day);
  if (d < t) d = new Date(t.getFullYear() + 1, s.month - 1, s.day);
  const date = `${d.getFullYear()}-${String(s.month).padStart(2,'0')}-${String(s.day).padStart(2,'0')}`;
  return { date, left: daysBetween(todayStr(), date), years: s.since ? d.getFullYear() - s.since : null };
}

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

// ---------- 💗 easter egg: couples' bingo ----------
// Intimate but warm — connection first, playful heat second. Center is free.
const BINGO_ITEMS = [
  '20-second kiss, no reason',
  'Slow dance in the kitchen',
  'Candlelit bath or shower together',
  'Massage night — full body, no rush',
  'Make out like teenagers (nothing more… yet)',
  'Breakfast in bed, phones off',
  'Whisper 3 things you love about their body',
  'Lingerie (or less) surprise',
  'Slow morning together before the day starts',
  'Phone-free night in bed',
  'Trade one fantasy each over a drink',
  'Blindfold + something soft',
  'Late-night hot tub or skinny dip',
  'Undress each other slowly, lights on',
  'Love note hidden in a pocket',
  'Recreate your first kiss',
  'Shower together, wash each other’s hair',
  'Flirty text thread during the workday',
  'Somewhere new in the house',
  'Yes / no / maybe lists — compare answers',
  'Sunset drive with no destination',
  'Read something steamy aloud together',
  'A kiss every time you pass each other (all day)',
  'Book a “hotel night” — even in town',
];
const BINGO_FREE = 12; // center square
function seedBingo() {
  const have = new Set(DB.bingo.map((b) => b.id));
  for (let n = 0; n < 25; n++) {
    const id = `bingo:${n}`;
    if (!have.has(id)) DB.bingo.push({ id, n, done: n === BINGO_FREE, updatedAt: '' });
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

// ---------- curated picks (baked in — no API needed) ----------
// Researched Jul 2026 for the Phoenix area. Ratings are reputation, not gospel.
const RECS = [
  { type: 'date', name: 'Café Monarch', area: 'Old Town Scottsdale', stars: 5,
    why: 'Routinely called the most romantic table in the Valley — candlelit patio, four-course prix fixe.',
    more: 'Family-run and it shows: unhurried, attentive, special-occasion energy. Book well ahead (it’s small), dress up a little, and do the patio. This is the anniversary-dinner mover.' },
  { type: 'date', name: 'Different Pointe of View', area: 'North Phoenix', stars: 4.5,
    why: 'Hilltop dining with sweeping city-lights views — arrive just before sunset.',
    more: 'Perched above Pointe Tapatio. Ask for a window or terrace table, time it to golden hour, and linger in the piano lounge after. City lights do half the romancing.' },
  { type: 'date', name: 'The Mission', area: 'Old Town Scottsdale', stars: 4.5,
    why: 'Moody candlelit modern-Latin spot — tableside guacamole, great cocktails.',
    more: 'Dark, warm, and buzzy without being loud. Get the tableside guac and the pork shoulder. Walkable to Old Town galleries for an after-dinner wander.' },
  { type: 'date', name: 'Pizzeria Bianco', area: 'Downtown Phoenix', stars: 4.5,
    why: 'James Beard-winning, possibly America’s best pizza — casual-romantic done right.',
    more: 'Chris Bianco’s original at Heritage Square. Go early or expect a wait (worth it). Rosa — red onion, rosemary, pistachio — is the sleeper hit. Low stakes, high delight.' },
  { type: 'date', name: 'Lon’s at the Hermosa', area: 'Paradise Valley', stars: 4.5,
    why: 'Adobe hacienda patio with fireplaces under desert stars.',
    more: 'A 1930s cowboy-artist’s estate turned inn. Patio + fire + Camelback views is the move. Also one of the Valley’s best brunches if you’d rather daytime-date.' },
  { type: 'date', name: 'House of Tricks', area: 'Tempe', stars: 4,
    why: 'Twinkle-lit garden patio hidden in two 1920s cottages near ASU.',
    more: 'The wine-country garden you don’t expect in Tempe. Seasonal menu, easygoing pace, lovely in fall through spring. Pair with a Mill Ave or Tempe Town Lake stroll.' },
  { type: 'date', name: 'Virtù Honest Craft', area: 'Old Town Scottsdale', stars: 4.5,
    why: 'Intimate Mediterranean tucked inside the Bespoke Inn — handmade pastas, courtyard seating.',
    more: 'Tiny, chef-driven, and quietly excellent. The courtyard feels like being let in on a secret. Great for a conversation-forward date night.' },
  { type: 'date', name: 'Kauboi', area: 'Scottsdale', stars: 4,
    why: 'New live-fire Japanese-American grill — wood, leather, low light.',
    more: 'At The Remi hotel; the stylish “we still go to new places” pick. Sit near the fire line if you can. Cocktails are the co-star.' },
  { type: 'date', name: 'Desert Botanical Garden evening', area: 'Papago Park', stars: 4.5,
    why: 'Sunset saguaro stroll; luminarias in winter, concerts and light shows in season.',
    more: 'Check the events calendar — Las Noches de las Luminarias (winter) and spring concert series are date gold. Gertrude’s, inside the garden, handles dinner.' },
  { type: 'date', name: 'First Friday + Roosevelt Row', area: 'Downtown Phoenix', stars: 4,
    why: 'Free monthly art walk — galleries, murals, food trucks, people-watching.',
    more: 'First Friday of every month. Wander the murals, duck into galleries, end on a rooftop downtown. Zero-pressure, zero-cost, always something new to talk about.' },

  { type: 'getaway', name: 'Sedona', area: '2h north', stars: 5,
    why: 'Red rocks, spas, creekside dinners, stargazing — the classic for a reason.',
    more: 'Sunset at Airport Mesa, browse Tlaquepaque, dinner creekside at L’Auberge, and a slow red-rock hike before brunch. Book fall/spring early; summer deals are real.' },
  { type: 'getaway', name: 'Castle Hot Springs', area: '1.5h, Bradshaw Mts', stars: 5,
    why: 'Adults-only hot-springs resort — the splurge-worthy anniversary getaway.',
    more: 'All-inclusive: farm-to-table dinners, crystal-clear 100°+ springs, cabins under dark skies. Expensive and worth saving for. Pairs beautifully with a 🏖️ escape pass.' },
  { type: 'getaway', name: 'Jerome', area: '2h north', stars: 4.5,
    why: 'Haunted hillside mining town — wine rooms, quirky inns, million-dollar views.',
    more: 'You two literally have an app for this one 🗺️. Caduceus tasting room, Ghost City Inn, and the switchback streets at dusk. Combine with Cottonwood’s Old Town wine row.' },
  { type: 'getaway', name: 'Flagstaff', area: '2.5h north', stars: 4,
    why: '7,000 ft of pines and cool air — craft beer, Lowell Observatory, snow in winter.',
    more: 'The anti-Phoenix: sweater weather. Stargaze at Lowell, walk the historic downtown breweries, do the aspens on Snowbowl Road in October. Winter = cozy snow weekend.' },
  { type: 'getaway', name: 'Prescott', area: '1.75h north', stars: 4,
    why: 'Whiskey Row, the courthouse square, lakes and cool pines — easy charm.',
    more: 'Kayak Watson Lake’s granite dells in the morning, antique the square in the afternoon, end on Whiskey Row. The low-effort, high-charm weekend.' },
  { type: 'getaway', name: 'Tucson + Tubac', area: '2h south', stars: 4,
    why: 'UNESCO City of Gastronomy plus a Spanish-colonial art village.',
    more: 'Eat your way through Tucson (Sonoran dogs to tasting menus), see Mission San Xavier del Bac, then browse Tubac’s galleries. Hotel Congress for retro charm.' },
  { type: 'getaway', name: 'Greer / White Mountains', area: '4h east', stars: 4,
    why: 'Creeks, meadows, and cabin fireplaces — the summer heat escape.',
    more: 'When Phoenix hits 110°, Greer is 75°. Book a fireplace cabin, walk the Little Colorado, bring books. Winter version: Sunrise ski weekend.' },

  { type: 'trip', name: 'Kauai or Maui', area: 'Hawaii', stars: 5,
    why: 'The reset-button trip — beaches, waterfalls, slow mornings, no jet lag to speak of.',
    more: 'Direct flights from PHX. Kauai for lush + quiet (Napali coast boat day is unmissable), Maui for variety. Book 6–9 months out for the good places.' },
  { type: 'trip', name: 'Italy — Rome + Amalfi', area: 'Europe', stars: 5,
    why: 'The classic milestone-anniversary trip: history, pasta, coastline.',
    more: 'Three nights Rome, four-plus on the Amalfi Coast (Positano or quieter Praiano). Go shoulder season — May or late September — for warm weather without the crush.' },
  { type: 'trip', name: 'Japan — Tokyo + Kyoto', area: 'Asia', stars: 5,
    why: 'Food, temples, bullet trains — unlike anywhere else you’ve been together.',
    more: 'Spring blossoms or November foliage. Split Tokyo energy and Kyoto calm; add an onsen ryokan night — the couples’ memory that outlasts the whole trip.' },
  { type: 'trip', name: 'Banff + Lake Louise', area: 'Canadian Rockies', stars: 4.5,
    why: 'Turquoise lakes, big mountains, cozy lodges — summer escape from the desert.',
    more: 'June–September for hiking and canoes on Lake Louise; January for a snow-globe winter trip. Drive the Icefields Parkway — it out-Instagrams everything.' },
  { type: 'trip', name: 'Cabo or Riviera Maya', area: 'Mexico', stars: 4,
    why: 'Short nonstop flight, all-inclusive ease — maximum romance per planning-hour.',
    more: 'The low-logistics option when the point is “just us, a pool, and dinner we didn’t plan.” Cabo from PHX is ~2 hours. Adults-only resorts are worth the difference.' },
];

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
  else if (current === 'ideas') renderIdeas();
  else if (current === 'goals') renderGoals();
  else if (current === 'bingo') renderBingo();
  else renderHistory();
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

  view.append(el('div', { class: 'special' }, SPECIAL.map((s) => {
    const nx = nextSpecial(s);
    const label = s.since ? `${s.label} · ${nx.years} yrs` : s.label;
    return el('div', { class: 'special-chip' }, [
      el('span', { class: 's-emoji' }, s.emoji),
      el('div', {}, [el('div', { class: 's-label' }, label), el('div', { class: 's-count' }, nx.left === 0 ? 'today! 🎉' : `${nx.left}d · ${fmt(nx.date)}`)]),
    ]);
  })));

  const t = todayStr();
  const upcoming = DB.entries.filter((e) => !e.deleted && (e.planned || e.date > t)).sort((a,b) => a.date < b.date ? -1 : 1);
  if (upcoming.length) {
    view.append(el('h2', {}, 'Coming up'));
    for (const e of upcoming) {
      const c = cadenceOf(e.type);
      const left = daysBetween(t, e.date);
      const when = left === 0 ? 'today!' : left === 1 ? 'tomorrow' : `in ${left}d`;
      const kids = [
        el('div', { class: 'card-top' }, [
          el('div', { class: 'card-emoji' }, c.emoji),
          el('div', {}, [
            el('div', { class: 'card-title' }, e.title || c.title),
            el('div', { class: 'card-cadence' }, `${fmt(e.date)}${e.notes ? ' · ' + e.notes : ''}`),
          ]),
          el('div', { class: 'card-right' }, [
            el('div', { class: 'countdown ' + (left <= 1 ? 'due' : 'ok') }, when),
            el('button', { class: 'btn btn-ghost btn-sm', title: 'Edit', onclick: () => logModal(e.type, { entry: e }) }, '✎'),
          ]),
        ]),
      ];
      // Getaways and trips planned ahead deserve their own guide app — Jerome set the bar.
      if (e.type !== 'date') kids.push(el('div', { class: 'card-meta', style: 'margin-top:8px' }, '🗺️ planned ahead? remember: build the trip-guide app (Jerome was a hit)'));
      view.append(el('div', { class: 'card next-card' }, kids));
    }
  }

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
  if (!list.length) view.append(el('div', { class: 'empty' }, ideaFilter === 'private' ? 'No private ideas yet — flip the lock and add one.' : 'No ideas of your own here yet — jot one above, or borrow a curated pick below.'));

  for (const idea of list) {
    const c = cadenceOf(idea.type);
    view.append(el('div', { class: 'row' + (idea.done ? ' done' : '') }, [
      el('span', { class: 'r-emoji' }, idea.private ? '🔒' : c.emoji),
      el('div', { class: 'r-main' }, [
        el('div', { class: 'r-title' }, idea.text),
        el('div', { class: 'r-meta' }, `${c.title}${idea.source === 'claude' ? ' · from Claude' : idea.source === 'pick' ? ' · curated pick' : ''}${idea.private ? ' · private, this device only' : ''}`),
      ]),
      el('div', { class: 'r-actions' }, [
        el('button', { class: 'btn btn-sm', title: 'Plan this', onclick: () => logModal(idea.type, { planned: true, prefill: idea.text, ideaId: idea.id }) }, 'Plan'),
        el('button', { class: 'btn btn-ghost btn-sm', title: 'Delete', onclick: () => { idea.deleted = true; idea.updatedAt = now(); commit(); render(); } }, '✕'),
      ]),
    ]));
  }

  if (ideaFilter !== 'private') {
    const recs = RECS.filter((r) => ideaFilter === 'all' || r.type === ideaFilter);
    view.append(el('h2', {}, 'Curated picks'));
    view.append(el('p', { class: 'muted small', style: 'margin: -4px 0 10px' }, 'Hand-researched, no API needed. Tap one for the full story.'));
    for (const r of recs) {
      const c = cadenceOf(r.type);
      view.append(el('div', { class: 'row rec', onclick: () => recModal(r) }, [
        el('span', { class: 'r-emoji' }, c.emoji),
        el('div', { class: 'r-main' }, [
          el('div', { class: 'r-title' }, `${r.name} · ${starStr(r.stars)}`),
          el('div', { class: 'r-meta' }, `${r.area} — ${r.why}`),
        ]),
        el('span', { class: 'chip' }, 'more'),
      ]));
    }
  }
}

const starStr = (s) => '★'.repeat(Math.floor(s)) + (s % 1 ? '½' : '');

function recModal(r) {
  const c = cadenceOf(r.type);
  const deeper = el('div', {});
  const body = [
    el('p', { class: 'muted small', style: 'margin:0' }, `${c.emoji} ${c.title} · ${r.area} · ${starStr(r.stars)}`),
    el('p', {}, r.why),
    el('p', { class: 'muted' }, r.more),
    deeper,
  ];
  const actions = [
    el('button', { class: 'btn', onclick: () => m.close() }, 'Close'),
    el('button', { class: 'btn btn-primary', onclick: () => {
      DB.ideas.unshift({ id: uid(), type: r.type, text: `${r.name} (${r.area})`, source: 'pick', done: false, private: privateMode, updatedAt: now() });
      commit(); m.close(); toast('Added to ideas 💡'); render();
    } }, '＋ Add to ideas'),
  ];
  if (hasKey()) actions.splice(1, 0, el('button', { class: 'btn', onclick: async (ev) => {
    const b = ev.currentTarget; b.disabled = true; b.innerHTML = '<span class="spinner"></span>';
    try {
      const s = DB.settings;
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': s.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 400, thinking: { type: 'disabled' }, messages: [{ role: 'user', content:
          `A married couple near ${s.city || 'Phoenix, AZ'} is considering this for a ${c.title.toLowerCase()}: ${r.name} (${r.area}). ${r.why} Give a short, practical deeper take: best time to go, 2-3 insider tips, what to book ahead, rough cost feel. Under 120 words, plain prose, no headers. Don't invent event dates.` }] }),
      });
      if (!res.ok) throw new Error('Claude ' + res.status);
      const json = await res.json();
      clear(deeper).append(el('p', { class: 'small', style: 'background: var(--surface-2); border-radius: 12px; padding: 12px' }, (json.content || []).filter((x) => x.type === 'text').map((x) => x.text).join('').trim()));
      b.remove();
    } catch (err) { toast('Deep dive failed: ' + err.message); b.disabled = false; b.textContent = '✨ Go deeper'; }
  } }, '✨ Go deeper'));
  const m = modal(r.name, body, actions);
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
const MEM_ICONS = { moment: '💫', food: '🍴', drink: '🍸', activity: '🥾' };
function memLine(e) {
  if (!e.mem) return null;
  const bits = Object.entries(e.mem).filter(([, v]) => v).map(([k, v]) => `${MEM_ICONS[k] || '•'} ${v}`);
  return bits.length ? el('div', { class: 'r-meta' }, bits.join('  ')) : null;
}
function historyRow(e, upcoming) {
  const c = cadenceOf(e.type);
  return el('div', { class: 'row' }, [
    el('span', { class: 'r-emoji' }, c.emoji),
    el('div', { class: 'r-main' }, [
      el('div', { class: 'r-title' }, e.title || c.title),
      el('div', { class: 'r-meta' }, `${fmt(e.date)}${e.notes ? ' · ' + e.notes : ''}`),
      memLine(e),
    ]),
    e.rating ? el('span', { class: 'chip love' }, '♥'.repeat(e.rating)) : (upcoming ? el('span', { class: 'chip' }, 'planned') : null),
    el('button', { class: 'btn btn-ghost btn-sm', title: 'Edit', onclick: () => logModal(e.type, { entry: e }) }, '✎'),
    el('button', { class: 'btn btn-ghost btn-sm', title: 'Delete', onclick: () => { e.deleted = true; e.updatedAt = now(); commit(); render(); } }, '✕'),
  ]);
}

// ---------- log / plan / edit modal ----------
// Memory questions per cadence — the stuff worth remembering later.
const MEMQ = {
  date:    [['moment', 'Favorite moment'], ['food', 'Favorite food'], ['drink', 'Favorite drink']],
  getaway: [['activity', 'Favorite activity'], ['food', 'Favorite food'], ['moment', 'A moment to keep']],
  trip:    [['activity', 'Favorite activity'], ['food', 'Favorite food'], ['moment', 'A moment to keep']],
};
const PLAN_LEAD = { date: 14, getaway: 45, trip: 180 }; // getaways & trips get planned early
function logModal(type, { planned = false, prefill = '', ideaId = null, entry = null } = {}) {
  const c = cadenceOf(type);
  if (entry) planned = Boolean(entry.planned);
  const title = el('input', { class: 'input', placeholder: 'What did you do? (optional)', value: entry ? (entry.title || '') : prefill });
  const date = el('input', { class: 'input', type: 'date', value: entry ? entry.date : planned ? addDays(todayStr(), PLAN_LEAD[type]) : todayStr() });
  const notes = el('input', { class: 'input', placeholder: 'A note to remember it by (optional)', value: entry ? (entry.notes || '') : '' });
  let rating = entry ? (entry.rating || 0) : 0;
  const stars = [1,2,3,4,5].map((n) => el('button', { class: n <= rating ? 'on' : '', onclick: () => { rating = rating === n ? 0 : n; stars.forEach((s,i) => s.classList.toggle('on', i < rating)); } }, '♥'));
  const ratingRow = el('div', {}, [el('label', { class: 'field-label' }, 'How was it?'), el('div', { class: 'rating' }, stars)]);

  const body = [
    el('label', { class: 'field-label' }, planned ? 'Planned date' : 'Date'), date,
    el('label', { class: 'field-label' }, c.title), title,
    el('label', { class: 'field-label' }, 'Notes'), notes,
  ];
  // Memories + rating make sense once it's happened (or when editing a past entry).
  const showExtras = !planned || (entry && entry.date <= todayStr());
  const memInputs = {};
  if (showExtras) {
    for (const [k, label] of MEMQ[type]) {
      memInputs[k] = el('input', { class: 'input', placeholder: 'optional', value: entry?.mem?.[k] || '' });
      body.push(el('label', { class: 'field-label' }, label), memInputs[k]);
    }
    body.push(ratingRow);
  }

  const heading = entry ? `Edit ${c.title.toLowerCase()}` : planned ? `Plan a ${c.title.toLowerCase()}` : `Log a ${c.title.toLowerCase()}`;
  const m = modal(heading, body, [
    el('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'),
    el('button', { class: 'btn btn-primary', onclick: () => {
      const mem = {};
      for (const [k] of MEMQ[type]) if (memInputs[k]?.value.trim()) mem[k] = memInputs[k].value.trim();
      if (entry) {
        Object.assign(entry, { date: date.value || entry.date, title: title.value.trim(), notes: notes.value.trim(), rating, mem, updatedAt: now() });
        // A planned entry edited to a past date has happened — graduate it to history.
        if (entry.planned && entry.date <= todayStr()) entry.planned = false;
        commit(); m.close(); toast('Updated 💞'); render();
        return;
      }
      DB.entries.push({ id: uid(), type, date: date.value || todayStr(), title: title.value.trim(), notes: notes.value.trim(), rating, mem, planned, updatedAt: now() });
      if (ideaId) { const it = DB.ideas.find((x) => x.id === ideaId); if (it) { it.done = true; it.updatedAt = now(); } }
      commit(); m.close();
      toast(planned ? 'Added to Coming up 💞' : 'Logged — nice 💞');
      render();
    } }, entry ? 'Save' : planned ? 'Plan it' : 'Log it'),
  ]);
  title.focus();
}

// ---------- 💗 bingo view (reached by tapping the topbar heart 6×) ----------
function bingoLines(doneSet) {
  const lines = [];
  for (let i = 0; i < 5; i++) {
    lines.push([0,1,2,3,4].map((j) => i * 5 + j));
    lines.push([0,1,2,3,4].map((j) => j * 5 + i));
  }
  lines.push([0,6,12,18,24], [4,8,12,16,20]);
  return lines.filter((L) => L.every((n) => doneSet.has(n)));
}
function renderBingo() {
  view.append(el('h1', {}, 'Just us 💗'), el('p', { class: 'sub' }, 'You found it. Twenty-five little ways to stay close — mark them together, get five in a row.'));
  view.append(el('button', { class: 'btn btn-ghost btn-sm', style: 'margin-bottom:12px', onclick: () => { current = 'rhythm'; setTab(); render(); } }, '← back'));

  const doneSet = new Set(DB.bingo.filter((b) => b.done).map((b) => b.n));
  const wins = bingoLines(doneSet);
  const inWin = new Set(wins.flat());
  if (wins.length) view.append(el('p', { class: 'small', style: 'font-weight:700; color: var(--accent)' }, `BINGO × ${wins.length} 🎉`));

  const cells = DB.bingo.slice().sort((a,b) => a.n - b.n).map((b) => {
    const free = b.n === BINGO_FREE;
    const label = free ? 'FREE — kiss right now 💋' : BINGO_ITEMS[b.n < BINGO_FREE ? b.n : b.n - 1];
    return el('button', {
      class: 'bcell' + (b.done ? ' done' : '') + (inWin.has(b.n) ? ' win' : ''),
      onclick: () => {
        if (free) { toast('That one’s always free 💋'); return; }
        b.done = !b.done; b.updatedAt = now(); commit();
        const nowWins = bingoLines(new Set(DB.bingo.filter((x) => x.done).map((x) => x.n))).length;
        if (b.done && nowWins > wins.length) toast('BINGO! You two 🎉💞');
        render();
      },
    }, label);
  });
  view.append(el('div', { class: 'bingo' }, cells));
  view.append(el('p', { class: 'muted small center', style: 'margin-top:14px' }, 'Synced between your phones. No pressure, no order — just excuses to reach for each other.'));
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
  return { entries: DB.entries, ideas: DB.ideas.filter((i) => !i.private), tickets: DB.tickets, bingo: DB.bingo, savedAt: now() };
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
      DB.bingo = mergeCol(DB.bingo, remote.bingo);
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

// 💗 easter egg: six quick taps on the wordmark heart opens couples' bingo.
let heartTaps = 0, heartTimer;
document.querySelector('.wordmark').addEventListener('click', () => {
  heartTaps++;
  clearTimeout(heartTimer);
  heartTimer = setTimeout(() => { heartTaps = 0; }, 1500);
  if (heartTaps >= 6) { heartTaps = 0; current = 'bingo'; setTab(); render(); }
});

applyTheme();
pruneTombstones();
seedTickets();
seedBingo();
render();
syncNow(false); // pull the other phone's changes on open
// Coming back to the app (phone unlock, tab switch) is the natural moment
// the other phone's changes matter — re-sync quietly.
document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleSync(); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
