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

// Shown in Settings so both phones can confirm which build they're actually
// running. Bump alongside sw.js CACHE on any shell change.
const APP_VERSION = 'v19 · what she sees';

// ---------- store (localStorage) ----------
const KEY = 'ortiz-us-os';
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function save(data) { localStorage.setItem(KEY, JSON.stringify(data)); }
let DB = load();
DB.entries ||= [];   // logged/planned dates: {id,type,date,dateEnd,title,loc,time,dress,pack,notes,rating,planned,status,mem,hidden,updatedAt,deleted}
DB.secrets ||= {};   // per-event hidden field values, DEVICE-LOCAL: { entryId: { field: value } } — never synced
DB.stash ||= {};     // 🎁 per-person surprise scratchpads (gift/trip ideas), DEVICE-LOCAL: { kat: [{id,text,done,createdAt}] } — never synced
DB.deepcache ||= {}; // paid-for ✨ results, DEVICE-LOCAL: { 'rec:<name>'|'plan:<entryId>': {text,at} } — kept ~30 days, never synced
DB.ideas ||= [];     // idea backlog: {id,type,text,source,done,private,updatedAt,deleted}
DB.tickets ||= [];   // goal passes: {id,goal,kind,n,used,usedAt,note,updatedAt}
DB.coupons ||= [];   // SENT love coupons only: {id,from,n,text,note,sentAt,seenAt,updatedAt,deleted}
DB.bingo ||= [];     // easter-egg bingo squares: {id,n,done,updatedAt}
DB.bingo2 ||= [];    // the card behind the card
DB.recstate ||= [];  // curated-pick reactions: {id,state:'dismissed'|'done'|'',updatedAt}
DB.settings ||= {};  // {apiKey,city,interests,theme,gistToken,gistId,lastSyncAt,who,couponHook} — never synced
const now = () => new Date().toISOString();
// Deletes are tombstones (deleted:true + updatedAt) so a removal on one phone
// wins over the stale copy on the other; pruned after 60 days.
function pruneTombstones() {
  const cutoff = new Date(Date.now() - 60 * 86400000).toISOString();
  DB.entries = DB.entries.filter((r) => !(r.deleted && (r.updatedAt || '') < cutoff));
  DB.ideas = DB.ideas.filter((r) => !(r.deleted && (r.updatedAt || '') < cutoff));
  // Drop hidden-field secrets whose entry is gone or tombstoned — nothing to overlay.
  const live = new Set(DB.entries.filter((e) => !e.deleted).map((e) => e.id));
  for (const id of Object.keys(DB.secrets)) if (!live.has(id)) delete DB.secrets[id];
  // Paid-for ✨ results are worth keeping — for ~30 days, then they age out.
  const dcut = new Date(Date.now() - 30 * 86400000).toISOString();
  for (const k of Object.keys(DB.deepcache)) if ((DB.deepcache[k].at || '') < dcut) delete DB.deepcache[k];
}
const commit = () => { save(DB); scheduleSync(); };

// ---------- 2-2-2 model ----------
const CADENCES = [
  { type: 'date',     emoji: '💞', title: 'Date night',       cadence: 'every 2 weeks',   days: 14 },
  { type: 'getaway',  emoji: '🧳', title: 'Weekend getaway',  cadence: 'every ~2 months', days: 61 },
  { type: 'trip',     emoji: '✈️', title: 'Destination trip', cadence: 'every ~2 years',  days: 730 },
  { type: 'occasion', emoji: '🎉', title: 'Special occasion', cadence: 'birthdays, anniversaries, big days', days: 0 },
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

// 🎁 Per-occasion surprise scratchpad, opened from a special-date row. Lives
// in DB.stash — device-local like secrets, so gift/trip ideas about the
// other person never sync. Saved with save(), not commit(): nothing to sync.
function stashSheet(sp) {
  const key = sp.label.toLowerCase();
  DB.stash[key] ||= [];
  const list = DB.stash[key];
  const inp = el('input', { class: 'input', placeholder: 'Gift idea, trip thought, a hint they dropped…', onkeydown: (e) => { if (e.key === 'Enter') add(); } });
  const wrap = el('div', {});
  function redraw() {
    clear(wrap);
    if (!list.length) wrap.append(el('p', { class: 'muted small center', style: 'padding:10px 0' }, 'Nothing stashed yet.'));
    for (const it of list) wrap.append(el('div', { class: 'row' + (it.done ? ' done' : '') }, [
      el('div', { class: 'r-main' }, el('div', { class: 'r-title' }, it.text)),
      el('button', { class: 'btn btn-ghost btn-sm', title: it.done ? 'Un-do' : 'Done / got it', onclick: () => { it.done = !it.done; save(DB); redraw(); } }, it.done ? '↩' : '✓'),
      el('button', { class: 'btn btn-ghost btn-sm', title: 'Delete', onclick: () => { list.splice(list.indexOf(it), 1); save(DB); redraw(); } }, '✕'),
    ]));
  }
  function add() {
    const text = inp.value.trim(); if (!text) return;
    list.unshift({ id: uid(), text, done: false, createdAt: now() });
    save(DB); inp.value = ''; redraw();
  }
  redraw();
  const m = modal(`${sp.emoji} ${sp.label} — your eyes only`, [
    el('p', { class: 'muted small', style: 'margin:0 0 10px' }, 'Gift ideas, trip thoughts, sizes, hints they dropped. Lives on THIS phone only — never syncs, so the surprise holds.'),
    el('div', { class: 'addbox' }, [inp, el('button', { class: 'btn btn-primary', onclick: add }, 'Add')]),
    wrap,
  ], [el('button', { class: 'btn btn-primary', onclick: () => { m.close(); render(); } }, 'Done')]);
  inp.focus();
}

// Guaranteed-valid lookup links: constructed searches (menu/prices, map &
// hours, reviews) rather than hardcoded venue URLs that rot.
function lookupLinks(query, type) {
  const q = encodeURIComponent(query);
  const money = type === 'getaway' || type === 'trip'
    ? ['🏨 Stays & prices', `https://www.google.com/search?q=${q}+hotels+prices`]
    : ['📋 Menu & prices', `https://www.google.com/search?q=${q}+menu+prices`];
  return el('div', { class: 'card-actions', style: 'margin-top:10px' }, [
    money,
    ['📍 Map & hours', `https://www.google.com/maps/search/?api=1&query=${q}`],
    ['⭐ Reviews', `https://www.yelp.com/search?find_desc=${q}`],
  ].map(([label, href]) => el('a', { class: 'btn btn-sm', href, target: '_blank', rel: 'noopener' }, label)));
}

// ---------- couple's goals ----------
// Same ten in each book — each of you has all ten to give.
const COUPON_ITEMS = [
  'I take your worst chore this week',
  'Sleep-in morning — I’ve got everything handled',
  'Breakfast in bed, no occasion needed',
  '30-minute massage, redeemable tonight',
  'Your night off — dinner’s on me, start to finish',
  'One guilt-free solo afternoon',
  'I plan the whole date — zero input needed',
  'Your pick tonight — movie, show, whatever',
  'Coffee delivered in bed for a whole week',
  'One “you were right” — no debate, no footnotes',
];
// Chris's book carries one extra — the app-introduction coupon, meant to be
// the very first send (and the live test of the whole coupon pipeline).
const INTRO_COUPON = 'I made this for us 💞 Redeem for the grand tour of Us OS, every question answered, and our first plan made together';
const COUPON_BOOK = {
  chris: [...COUPON_ITEMS, INTRO_COUPON],
  kat:   [...COUPON_ITEMS],
};
const COUPLE = {
  chris: { name: 'Chris', emoji: '💙' },
  kat:   { name: 'Kat',   emoji: '💜' },
};
const other = (w) => (w === 'chris' ? 'kat' : 'chris');
const me = () => DB.settings.who || '';

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

// Love coupons moved from mark-after-done tickets (love-coupons:kind:n) to
// sent-coupon records. Only SENT coupons exist in data — your unsent book is
// static code, so it never transits the Gist and every send lands as a
// surprise. Ids stay deterministic (coupon:kind:n); migration copies the old
// ticket's updatedAt so both phones produce identical records and the merge
// is idempotent. Old tickets stay in DB untouched for not-yet-updated phones.
function migrateCoupons() {
  const have = new Set(DB.coupons.map((c) => c.id));
  for (const t of DB.tickets) {
    if (t.goal !== 'love-coupons' || !t.used) continue;
    const id = `coupon:${t.kind}:${t.n}`;
    if (have.has(id)) continue;
    DB.coupons.push({ id, from: t.kind, n: t.n, text: COUPON_ITEMS[t.n - 1], note: t.note || '',
      sentAt: t.usedAt || '', seenAt: t.updatedAt || now(), updatedAt: t.updatedAt || now() });
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
  'Bring home flowers, just because',
  'Slow morning together before the day starts',
  'Phone-free night in bed',
  'Trade one fantasy each over a drink',
  'A small gift with intention — something they mentioned once',
  'Late-night hot tub or skinny dip',
  'Write why you chose them — leave it on their pillow',
  'Love note hidden in a pocket',
  'Recreate your first kiss',
  'Shower together, wash each other’s hair',
  'Flirty text thread during the workday',
  'Make their coffee before they’re up',
  'Yes / no / maybe lists — compare answers',
  'Sunset drive with no destination',
  'Plan a surprise micro-date — 90 minutes, zero notice',
  'A kiss every time you pass each other (all day)',
  'Book a “hotel night” — even in town',
];
// Card two lives behind the free square of card one. Adult, consensual,
// still non-graphic — heat for two people who already trust each other.
const BINGO2_ITEMS = [
  'A brand-new position — pick it together',
  'Her on top, her pace, her rules',
  'From behind, hands everywhere',
  'Standing — wall or counter',
  'Dead quiet — first one to make a sound loses',
  'Morning quickie before the alarm snoozes',
  'Shower sex (towel on the floor, you’re welcome)',
  'Oral — all about her',
  'Oral — all about him',
  '69',
  'Edge each other — nobody finishes until asked nicely',
  'Dirty talk only — say exactly what you want',
  'Blindfold + restraints (pick a safeword first)',
  'Strip tease — full commitment, music on',
  'Lap dance that breaks the no-touching rule',
  'Body-oil massage that escalates',
  'One of you is in charge tonight — trade next time',
  'In front of a mirror',
  'Kitchen counter or table',
  'Parked in the garage, teenage rules',
  'Hotel night: do not leave the room',
  'Toy night — new one or the favorite',
  'Roleplay: strangers at a bar who go home together',
  'Sleepy morning sex — green-lit the night before',
];
const BINGO_FREE = 12; // center square
function seedBingo() {
  for (const [col, key] of [[DB.bingo, 'bingo'], [DB.bingo2, 'bingo2']]) {
    const have = new Set(col.map((b) => b.id));
    for (let n = 0; n < 25; n++) {
      const id = `${key}:${n}`;
      if (!have.has(id)) col.push({ id, n, done: n === BINGO_FREE, updatedAt: '' });
    }
  }
}
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const parse = (s) => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate()+n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
function fmt(s) { return parse(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: parse(s).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }); }
function fmtTime(t) { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; }

// ---------- per-event privacy ----------
// A hidden field's real value lives ONLY in DB.secrets on the phone that set
// it (never synced). The synced entry carries just entry.hidden (the field
// keys) so the other phone knows to show a 🔒 teaser. shownVal returns the
// real value if THIS phone owns the secret, null if it's the partner's
// surprise, or the plain synced value otherwise.
const HIDEABLE = ['title', 'loc', 'time', 'dress', 'dateEnd', 'pack', 'notes'];
const iOwnSecret = (e, k) => Boolean(DB.secrets[e.id] && k in DB.secrets[e.id]);
function shownVal(e, k) {
  if (iOwnSecret(e, k)) return DB.secrets[e.id][k];
  if ((e.hidden || []).includes(k)) return null; // partner — kept a surprise
  return e[k];
}
// value → string for a card line: real value, '🔒' if the partner's surprise, '' if empty.
function lineVal(e, k, fmtFn) {
  const v = shownVal(e, k);
  if (v === null) return '🔒';
  if (!v) return '';
  return fmtFn ? fmtFn(v) : v;
}
function titleText(e) {
  const v = shownVal(e, 'title');
  if (v === null) return '🔒 A surprise 💝';
  return v || cadenceOf(e.type).title;
}
function notesSuffix(e) {
  const v = shownVal(e, 'notes');
  if (v === null) return ' · 🔒';
  return v ? ' · ' + v : '';
}
// One line that reads like a plan: "Jul 20 – Jul 24 · 7:30 PM · Sedona · dressy"
function whenWhere(e) {
  const end = shownVal(e, 'dateEnd');
  const range = fmt(e.date) + (end === null ? ' – 🔒' : end ? ' – ' + fmt(end) : '');
  return [range, lineVal(e, 'time', fmtTime), lineVal(e, 'loc'), lineVal(e, 'dress')].filter(Boolean).join(' · ');
}
const FIELD_LABEL = { title: 'Title', loc: 'Location', time: 'Time', dress: 'Dress', dateEnd: 'End date', pack: 'Packing', notes: 'Notes' };
// Fields THIS phone has locked as a surprise (the ones I set the secret for).
const ownerHidden = (e) => (e.hidden || []).filter((k) => iOwnSecret(e, k));
const partnerName = () => (me() ? COUPLE[other(me())].name : 'your partner');
// Owner-side confidence: a badge on the card naming exactly what the other
// phone can't see, so a locked field is never a guess.
function lockBadge(e) {
  const mine = ownerHidden(e);
  if (mine.length) return el('div', { class: 'lockbadge' }, `🔒 Hidden from ${partnerName()}: ${mine.map((k) => FIELD_LABEL[k]).join(', ')}`);
  if ((e.hidden || []).length) return el('div', { class: 'lockbadge them' }, '🔒 A surprise is set for you 💝');
  return null;
}

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
  { type: 'date', name: 'Postino (Arcadia or Central)', area: 'Arcadia', stars: 4,
    why: 'Bruschetta boards, a bottle of wine, string lights — the easy, unfussy date.',
    more: 'The garage doors roll up in spring and fall. Get a bruschetta board, the $25 board-and-bottle deal on select evenings, and split a soft-serve after. Low stakes, high hang.' },
  { type: 'date', name: 'Musical Instrument Museum', area: 'North Phoenix', stars: 4.5,
    why: 'A wireless-headphone wander through instruments — and music — from every country on earth.',
    more: 'Weirdly romantic and genuinely unique: you drift room to room and the audio follows you. Check the concert calendar — the intimate MIM Music Theater books great acts. Daytime date that ends before dinner.' },
  { type: 'date', name: 'Rooftop cocktails — Mowry & Cotton / Lustre', area: 'Paradise Valley / Downtown', stars: 4,
    why: 'Skyline-and-sunset drinks — dressed up a little, no dinner reservation required.',
    more: 'Mowry & Cotton at The Phoenician for resort polish; Lustre atop the Kimpton Palomar for downtown-skyline buzz. Go for golden hour, order two cocktails, and let the view do the work.' },
  { type: 'date', name: 'FnB', area: 'Old Town Scottsdale', stars: 4.5,
    why: 'Chef-driven, veg-forward Arizona cooking — a tiny room that regulars guard jealously.',
    more: 'James Beard-recognized and all about what’s in season locally. Small, warm, conversation-easy. Their all-Arizona wine list is a talking point in itself. Book ahead — it fills.' },
  { type: 'date', name: 'Barrio Café', area: 'Central Phoenix', stars: 4,
    why: 'Tableside guac, cochinita pibil, and a mole worth the drive — modern Mexican with soul.',
    more: 'Chef Silvana Salcido Esparza’s landmark. No reservations, so go early or grab a margarita while you wait. The 24-ingredient mole poblano and the chiles en nogada (in season) are the moves.' },
  { type: 'date', name: 'Camelback or Piestewa sunrise + brunch', area: 'Phoenix / Scottsdale', stars: 4,
    why: 'Beat the heat with an early summit, then reward yourselves with a big breakfast.',
    more: 'Echo Canyon (Camelback) is the scramble; Piestewa is the friendlier climb. Start at first light Oct–April, then roll to Morning Squeeze or Ncounter. Active, cheap, and you’ve done something together before 10am.' },
  { type: 'date', name: 'Stand-up at Stand Up Live', area: 'Downtown Phoenix', stars: 4,
    why: 'A real comedy club — dinner-and-a-show energy without leaving downtown.',
    more: 'Touring headliners most weekends. Grab dinner at CityScape nearby, then two-drink-minimum your way through the late show. Book a booth, sit close-ish (not front-row unless you want in on it).' },
  { type: 'date', name: 'The Ostrich', area: 'Downtown Chandler', stars: 4.5,
    why: 'Speakeasy hidden beneath Crust — moody basement cocktails, ten minutes from home.',
    more: 'Down the stairs inside Crust Simply Italian on San Marcos Place. Low ceilings, craft cocktails, 1920s basement bones (it really was a bootlegger-era cellar). Do dinner upstairs, descend for the nightcap. Weekends fill — go early or midweek.' },
  { type: 'date', name: 'The Perch Brewery', area: 'Downtown Chandler', stars: 4,
    why: 'Craft beer on a patio full of rescued tropical birds — the most Chandler thing there is.',
    more: 'Dozens of rescued parrots and macaws around the beer garden. Casual, loud in the fun way, and walkable to the rest of downtown Chandler. Evening patio weather Oct–May is the move.' },
  { type: 'date', name: 'Hidden House', area: 'Chandler', stars: 4,
    why: 'A cocktail lounge tucked behind an unassuming little house — date-night speakeasy #2.',
    more: 'Just off Dr. A.J. Chandler Park. Dark, intimate, serious cocktail list. Small enough that it feels like a secret even when it’s busy. Pair with dinner on the square and walk over.' },
  { type: 'date', name: 'Downtown Gilbert crawl', area: 'Heritage District', stars: 4.5,
    why: 'The water tower strip: Postino, OHSO, Barrio Queen, Culinary Dropout — pick two and wander.',
    more: 'The southeast valley’s best walkable date. Snag a patio at Postino Annex for wine + bruschetta, wander under the tower, end with dessert or a game of cornhole at Culinary Dropout. Look for the White Rabbit if you know, you know.' },
  { type: 'date', name: 'Hale Centre Theatre', area: 'Downtown Gilbert', stars: 4,
    why: 'Live theatre in the round, then a Heritage District dinner — a proper dressed-up date.',
    more: 'Family-run, musicals and comedies year-round, seats close to the action. Tickets are reasonable; book dinner nearby before the show. Check the season calendar and grab dates early for popular runs.' },
  { type: 'date', name: 'Riparian Preserve + observatory night', area: 'Gilbert', stars: 4,
    why: 'Sunset walk among the herons, then real telescope time at the Gilbert observatory.',
    more: 'The Riparian Preserve at Water Ranch: 110 acres of ponds and trails that don’t feel like the suburbs. The Rotary Centennial Observatory next to the library opens for public viewing most Friday/Saturday nights — check hours. Cheap, unhurried, quietly romantic.' },
  { type: 'date', name: 'Barnone at Agritopia', area: 'Gilbert', stars: 4.5,
    why: 'A makers’ hall in a farm neighborhood — urban winery, wood-fired pizza, workshops.',
    more: 'Garage-East pours wine made on site; grab pizza next door and walk Agritopia’s farm lanes after. First-Friday-style events some months. The “we did something different” date that’s 15 minutes away.' },
  { type: 'date', name: 'Schnepf Farms', area: 'Queen Creek', stars: 4.5,
    why: 'Peach-picking mornings in May, farm dinners in the orchard in season.',
    more: 'The Dinner Down the Orchard series (fall–spring) is a genuinely special night — long table, string lights, chef-cooked courses between the trees. Book the moment dates drop. Peach season (roughly May) makes a great morning date with pie.' },
  { type: 'date', name: 'Queen Creek Olive Mill', area: 'Queen Creek', stars: 4,
    why: 'Olive-oil tasting, mill tours, and a long Tuscan-ish lunch under the trees.',
    more: 'Arizona’s only working olive mill. Do the tasting bar, split a charcuterie board at del Piero, and bring home a bottle. Daytime date; pairs well with a Schnepf Farms or San Tan hike add-on.' },
  { type: 'date', name: 'Koli Equestrian Center sunset ride', area: 'Chandler / Gila River', stars: 4,
    why: 'Guided horseback through the Sonoran desert at golden hour — 20 minutes from home.',
    more: 'On the Gila River Community just south of Chandler. The sunset rides are the ones worth booking — saguaros, mountains, that light. No experience needed; wear jeans. Reserve ahead, especially in cooler months.' },
  { type: 'date', name: 'Desert Belle on Saguaro Lake', area: '45 min northeast', stars: 4,
    why: 'A narrated sunset cruise between canyon walls — desert lake date, zero effort.',
    more: 'The Desert Belle runs narrated cruises on Saguaro Lake; the twilight and live-music sailings are the date ones. Canyon walls, bighorn sightings if you’re lucky, and a bar on board. Book ahead in spring and fall, and grab dinner in Mesa on the way home.' },

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
  else if (current === 'bingo' || current === 'bingo2') renderBingo();
  else if (current === 'settings') renderSettings();
  else renderHistory();
}

// ---------- couple's goals ----------
function renderGoals() {
  view.append(el('h1', {}, 'Couple’s goals'), el('p', { class: 'sub' }, 'Shared commitments — with grace built in.'));
  const t = todayStr();
  for (const g of GOALS) {
    const left = g.ends ? daysBetween(t, g.ends) : null;
    const kids = [
      el('div', { class: 'card-top' }, [
        el('div', { class: 'card-emoji' }, g.emoji),
        el('div', {}, [el('div', { class: 'card-title' }, g.title), el('div', { class: 'card-cadence' }, g.sub)]),
        el('div', { class: 'card-right' }, el('div', { class: 'countdown ok' }, left == null ? '∞' : left < 0 ? 'done!' : `${left}d left`)),
      ]),
    ];
    for (const p of g.passes) {
      const tix = DB.tickets.filter((x) => x.goal === g.id && x.kind === p.kind).sort((a,b) => a.n - b.n);
      const remaining = tix.filter((x) => !x.used).length;
      kids.push(el('div', { class: 'pass-head' }, [
        el('span', {}, `${p.emoji} ${p.label}`),
        el('span', { class: 'chip' + (remaining ? ' love' : '') }, `${remaining} of ${tix.length} left`),
      ]));
      kids.push(el('div', { class: 'tickets' }, tix.map((x) => el('button', {
        class: 'ticket' + (x.used ? ' used' : ''),
        title: x.used ? `Used ${x.usedAt ? fmt(x.usedAt) : ''}${x.note ? ' · ' + x.note : ''}` : `${p.one} #${x.n}`,
        onclick: () => ticketModal(x, p),
      }, [
        el('span', { class: 't-emoji' }, p.emoji),
        el('span', { class: 't-n' }, x.used ? '✓' : x.n),
      ]))));
    }
    view.append(el('div', { class: 'card' }, kids));
  }
  view.append(couponsCard());
  // 🎁 Year-round door to the surprise stashes — the special-date rows only
  // surface near the date, but gift ideas accumulate all year. Booked stays
  // clean; this card is the permanent way in.
  view.append(el('div', { class: 'card' }, [
    el('div', { class: 'card-top' }, [
      el('div', { class: 'card-emoji' }, '🎁'),
      el('div', {}, [el('div', { class: 'card-title' }, 'Surprise stashes'),
        el('div', { class: 'card-cadence' }, 'Gift & trip ideas about each other, saved all year. Each phone keeps its own — nothing here syncs.')]),
    ]),
    el('div', { class: 'card-actions', style: 'margin-top:12px' }, SPECIAL.map((s) => {
      const open = (DB.stash[s.label.toLowerCase()] || []).filter((x) => !x.done).length;
      return el('button', { class: 'btn btn-sm', onclick: () => stashSheet(s) }, `${s.emoji} ${s.label}${open ? ` · ${open}` : ''}`);
    })),
  ]));
}

function ticketModal(x, p) {
  if (x.used) {
    const m = modal(`${p.emoji} Used: ${p.one}`, [
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
  const m = modal(`${p.emoji} Use a ${p.one}?`, [
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

// ---------- 💌 love coupons (send / receive) ----------
// Your own coupons wear a red ❤️ (love you're giving); a coupon that arrived
// from the other person is tinted their colour (💙 Chris / 💜 Kat) so the
// sender reads at a glance on the shelf.
function couponCardEl(c) {
  const mine = c.from === me();
  return el('div', { class: 'coupon-card' + (mine ? '' : ' from-' + c.from) }, [
    el('div', { class: 'c-emoji' }, mine ? '❤️' : COUPLE[c.from].emoji),
    el('div', { class: 'c-text' }, c.text),
    c.note ? el('div', { class: 'c-note' }, `“${c.note}”`) : null,
  ]);
}

function couponsCard() {
  const who = me();
  const kids = [
    el('div', { class: 'card-top' }, [
      el('div', { class: 'card-emoji' }, '💌'),
      el('div', {}, [el('div', { class: 'card-title' }, 'Love coupons'),
        el('div', { class: 'card-cadence' }, 'Ten each to give. Send one when you mean it — it lands on their phone as a little surprise. No expiration.')]),
      el('div', { class: 'card-right' }, el('div', { class: 'countdown ok' }, '∞')),
    ]),
  ];
  if (!who) {
    kids.push(
      el('p', { class: 'muted small' }, 'First: whose phone is this? Pick once — it stays on this device, so your unsent coupons stay your secret.'),
      el('div', { class: 'card-actions' }, ['chris', 'kat'].map((w) => el('button', {
        class: 'btn btn-primary btn-sm',
        onclick: () => { DB.settings.who = w; save(DB); toast(`Hi, ${COUPLE[w].name} ${COUPLE[w].emoji}`); render(); maybeReveal(); },
      }, `${COUPLE[w].emoji} I’m ${COUPLE[w].name}`))),
    );
    return el('div', { class: 'card' }, kids);
  }

  const theirs = COUPLE[other(who)];
  const book = COUPON_BOOK[who];
  const sent = new Map(DB.coupons.filter((c) => c.from === who && !c.deleted).map((c) => [c.n, c]));
  kids.push(el('div', { class: 'pass-head' }, [
    el('span', {}, `❤️ Your book — tap one to send`),
    el('span', { class: 'chip' + (sent.size < book.length ? ' love' : '') }, `${book.length - sent.size} of ${book.length} to give`),
  ]));
  kids.push(el('div', { class: 'tickets coupons' }, book.map((text, i) => {
    const c = sent.get(i + 1);
    if (!c) return el('button', { class: 'ticket' + (text === INTRO_COUPON ? ' intro' : ''), title: text, onclick: () => sendCouponModal(i + 1) }, [
      el('span', { class: 't-emoji' }, text === INTRO_COUPON ? '✨' : '❤️'),
      el('span', { class: 't-label' }, text),
    ]);
    return el('button', {
      class: 'ticket used',
      title: `Sent ${c.sentAt ? fmt(c.sentAt) : ''} · ${c.seenAt ? 'opened' : 'not opened yet'}`,
      onclick: () => sentCouponModal(c),
    }, [
      el('span', { class: 't-emoji' }, c.seenAt ? '💗' : '💌'),
      el('span', { class: 't-label' }, c.text),
    ]);
  })));

  const recv = DB.coupons.filter((c) => c.from !== who && !c.deleted).sort((a, b) => ((b.sentAt || '') < (a.sentAt || '') ? -1 : 1));
  kids.push(el('div', { class: 'pass-head' }, [
    el('span', {}, `${theirs.emoji} From ${theirs.name} — yours to keep`),
    el('span', { class: 'chip' + (recv.length ? ' love' : '') }, `${recv.length} received`),
  ]));
  if (!recv.length) kids.push(el('p', { class: 'muted small', style: 'margin:0' }, `Coupons ${theirs.name} sends you land here 💌`));
  else kids.push(el('div', { class: 'tickets coupons' }, recv.map((c) => el('button', {
    class: 'ticket recv from-' + c.from, title: c.sentAt ? `Sent ${fmt(c.sentAt)}` : '',
    onclick: () => recvCouponModal(c),
  }, [
    el('span', { class: 't-emoji' }, COUPLE[c.from].emoji),
    el('span', { class: 't-label' }, c.text),
    c.sentAt ? el('span', { class: 't-date' }, fmt(c.sentAt)) : null,
  ]))));
  return el('div', { class: 'card' }, kids);
}

function sendCouponModal(n) {
  const who = me(), theirs = COUPLE[other(who)];
  const note = el('input', { class: 'input', placeholder: 'Add a little note (optional)' });
  const m = modal(`💌 Send this to ${theirs.name}?`, [
    couponCardEl({ from: who, text: COUPON_BOOK[who][n - 1] }),
    el('p', { class: 'muted small', style: 'margin:0' },
      `It’ll appear in ${theirs.name}’s app as a surprise${DB.settings.couponHook ? ', with a little email nudge' : ''}. A coupon is a promise — no expiration.`),
    el('label', { class: 'field-label' }, 'Note'), note,
  ], [
    el('button', { class: 'btn', onclick: () => m.close() }, 'Not yet'),
    el('button', { class: 'btn btn-primary', onclick: () => {
      sendCoupon(n, note.value.trim());
      m.close(); toast(`On its way to ${theirs.name} 💌`); render();
    } }, '💌 Send it'),
  ]);
  note.focus();
}

// Re-sending after a take-back reuses the tombstoned record — deterministic
// ids mean flipping deleted back off, never a second record.
function sendCoupon(n, note) {
  const who = me();
  const id = `coupon:${who}:${n}`;
  let c = DB.coupons.find((x) => x.id === id);
  if (!c) { c = { id, from: who, n }; DB.coupons.push(c); }
  Object.assign(c, { deleted: false, text: COUPON_BOOK[who][n - 1], note, sentAt: todayStr(), seenAt: null, updatedAt: now() });
  commit();
  sendCouponNudge(who);
}

function sentCouponModal(c) {
  const theirs = COUPLE[other(c.from)];
  const m = modal(`💌 Sent to ${theirs.name}`, [
    couponCardEl(c),
    el('p', { class: 'muted small' }, `Sent ${c.sentAt ? fmt(c.sentAt) : '—'} · ${c.seenAt ? 'opened 💗' : 'not opened yet'}`),
  ], [
    el('button', { class: 'btn', onclick: () => m.close() }, 'Close'),
    el('button', { class: 'btn btn-ghost', onclick: () => {
      c.deleted = true; c.updatedAt = now();
      // Keep the legacy ticket in step so migration can never resurrect this.
      const t = DB.tickets.find((x) => x.id === `love-coupons:${c.from}:${c.n}`);
      if (t?.used) Object.assign(t, { used: false, usedAt: null, note: '', updatedAt: now() });
      commit(); m.close(); toast('Back in your book'); render();
    } }, '↩ Take it back'),
  ]);
}

function recvCouponModal(c) {
  const sender = COUPLE[c.from];
  const m = modal(`${sender.emoji} From ${sender.name}`, [
    couponCardEl(c),
    el('p', { class: 'muted small' }, `${c.sentAt ? 'Sent ' + fmt(c.sentAt) + ' — no' : 'No'} strings, no expiration. Cash it in whenever.`),
  ], [el('button', { class: 'btn btn-primary', onclick: () => m.close() }, 'Close')]);
}

// The in-app reveal IS the notification: after any sync that brings in a new
// coupon addressed to this phone, pop the reveal sheet. Marking seenAt on
// show (not on close) keeps a scrim-tap dismiss from re-popping it forever,
// and flips the sender's ticket to "opened 💗" on their next sync.
function maybeReveal() {
  const who = me();
  if (!who || document.querySelector('.scrim')) return;
  const fresh = DB.coupons.filter((c) => !c.deleted && c.from !== who && !c.seenAt);
  if (!fresh.length) return;
  for (const c of fresh) { c.seenAt = now(); c.updatedAt = now(); }
  commit();
  const sender = COUPLE[fresh[0].from];
  const m = modal(`💌 ${sender.name} sent you ${fresh.length === 1 ? 'a love coupon' : fresh.length + ' love coupons'}`, [
    ...fresh.map(couponCardEl),
    el('p', { class: 'muted small center' }, 'Yours to keep — it lives in Goals whenever you want to cash it in.'),
  ], [el('button', { class: 'btn btn-primary', onclick: () => { m.close(); render(); } }, '💝 Keep it')]);
}

// Best-effort teaser email via the couple's Apps Script webhook — see
// COUPON_EMAIL.md. text/plain keeps it a "simple" request (no CORS preflight,
// which Apps Script can't answer). The coupon itself travels by Gist sync;
// a failed nudge only costs the email, never the coupon.
function sendCouponNudge(from) {
  const url = DB.settings.couponHook;
  if (!url) return;
  fetch(url, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ from }) })
    .then((r) => { if (!r.ok) throw new Error(); })
    .catch(() => toast('Coupon sent in-app — the email nudge didn’t go through'));
}

function upcomingCard(e) {
  const t = todayStr();
  const c = cadenceOf(e.type);
  const left = daysBetween(t, e.date);
  const when = left === 0 ? 'today!' : left === 1 ? 'tomorrow' : `in ${left}d`;
  const booked = e.status === 'booked';
  const details = el('button', { class: 'btn btn-sm' + (booked ? ' btn-ghost' : ' btn-primary'), title: 'Location, time, what to pack…',
    onclick: (ev) => { ev.stopPropagation(); logModal(e.type, { entry: e }); } }, '✎ Details');
  const bookToggle = el('button', { class: 'btn btn-sm', title: booked ? 'Mark as still planning' : 'It’s a done deal',
    onclick: (ev) => { ev.stopPropagation(); e.status = booked ? 'planning' : 'booked'; e.updatedAt = now(); commit(); render(); } },
    booked ? '↩ back to planning' : '✅ mark booked');
  const ideas = !booked && hasKey() ? el('button', { class: 'btn btn-sm', onclick: (ev) => { ev.stopPropagation(); planWithClaude(e); } }, '✨ Ideas') : null;
  const kids = [
    el('div', { class: 'card-top' }, [
      el('div', { class: 'card-emoji' }, c.emoji),
      el('div', {}, [
        el('div', { class: 'card-title' }, titleText(e)),
        el('div', { class: 'card-cadence' }, `${whenWhere(e)}${notesSuffix(e)}`),
      ]),
      el('div', { class: 'card-right' }, el('div', { class: 'countdown ' + (left <= 1 ? 'due' : 'ok') }, when)),
    ]),
    lockBadge(e),
    // Still planning? Details lead — that's what you need to book. Once booked,
    // details step back and the "still planning" toggle leads.
    el('div', { class: 'card-actions', style: 'margin-top:10px' }, booked ? [bookToggle, details] : [details, bookToggle, ideas]),
  ];
  // Getaways and trips planned ahead deserve their own guide app — Jerome set the bar.
  if ((e.type === 'getaway' || e.type === 'trip') && !booked) kids.push(el('div', { class: 'card-meta', style: 'margin-top:8px' }, '🗺️ while you plan: remember the trip-guide app (Jerome was a hit)'));
  // The whole card is the event — tap anywhere to open its details.
  return el('div', { class: 'card next-card clickable', onclick: () => logModal(e.type, { entry: e }) }, kids);
}

// Geographic reach per cadence — date nights stay close, getaways range wide.
const IDEA_SCOPE = {
  date: 'Keep every option LOCAL to the southeast valley — Chandler, Gilbert, Queen Creek, Mesa, Tempe — a short drive from home, a normal evening out. Downtown Chandler and downtown Gilbert (Heritage District) are the home turf; only reach to Scottsdale or Phoenix for something truly worth the drive.',
  occasion: 'Options can range across the greater Phoenix metro (Chandler, Gilbert, Scottsdale, Mesa, Tempe, downtown Phoenix) — worth a longer drive for something special.',
  getaway: 'Options can be anywhere in Arizona or within about a 6-hour drive of Phoenix (Sedona, Flagstaff, Prescott, Tucson, Bisbee, even San Diego, Vegas, or Rocky Point).',
  trip: 'Options are bigger destination trips — flights and multiple nights are fine.',
};
// The ladder: idea → plan (intention, dated) → ✅ booked. This "✨ Ideas"
// button lives at the "plan" rung — concrete options to turn intention into a
// booking, scoped by how far the cadence should reach.
async function planWithClaude(e, force = false) {
  const c = cadenceOf(e.type);
  // You paid for these tokens — cached ideas show instantly for ~30 days;
  // only an explicit refresh spends again.
  const cacheKey = 'plan:' + e.id;
  const cached = !force && DB.deepcache[cacheKey];
  const out = el('p', { class: 'small' }, cached ? cached.text : el('span', { class: 'spinner' }));
  const m = modal(`✨ Ideas: ${titleText(e)}`, [
    out,
    cached ? el('p', { class: 'muted small' }, `Saved ${fmt(cached.at.slice(0, 10))} — refresh for new ones.`) : null,
  ].filter(Boolean), [
    cached ? el('button', { class: 'btn', onclick: () => { m.close(); planWithClaude(e, true); } }, '↻ Fresh ideas') : null,
    el('button', { class: 'btn btn-primary', onclick: () => m.close() }, 'Close'),
  ].filter(Boolean));
  if (cached) return;
  try {
    const s = DB.settings;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': s.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      // Date nights are a few hours, not a festival: options must be separate,
      // single-focus alternatives — never interests stacked into one itinerary.
      body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 500, thinking: { type: 'disabled' }, messages: [{ role: 'user', content:
        `A married couple near ${s.city || 'Chandler/Gilbert, AZ (southeast Phoenix valley)'} intends to book this ${c.title.toLowerCase()}: "${shownVal(e, 'title') || 'untitled'}" on ${e.date}${shownVal(e, 'loc') ? ` at/around ${shownVal(e, 'loc')}` : ''}${shownVal(e, 'notes') ? ` (notes: ${shownVal(e, 'notes')})` : ''}.`
        + ` ${IDEA_SCOPE[e.type]}`
        + (s.interests ? ` Their interests (pick ONE per option, don't combine them): ${s.interests}.` : '')
        + ((e.type === 'date' || e.type === 'occasion')
          ? ` They have only a few hours that evening. Offer 2-3 SEPARATE single-focus options — each is one thing to do (one restaurant OR one hike OR one show — never dinner plus an activity chained together). For each: the real place by name, why it fits, and what to reserve or check ahead.`
          : ` Offer 2-3 concrete suggestions naming real places, what to reserve and how far ahead, and one upgrade worth considering.`)
        + ` Under 150 words, plain prose, no headers, no invented event dates.` }] }),
    });
    if (!res.ok) throw new Error('Claude ' + res.status);
    const json = await res.json();
    const text = (json.content || []).filter((x) => x.type === 'text').map((x) => x.text).join('').trim();
    out.textContent = text;
    DB.deepcache[cacheKey] = { text, at: now() };
    save(DB);
  } catch (err) {
    out.textContent = 'Ideas fetch failed: ' + err.message;
  }
}

function renderRhythm() {
  view.append(el('h1', {}, 'Your rhythm'), el('p', { class: 'sub' }, 'The 2-2-2 you two live by — kept on pace.'));

  const jump = (id) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  view.append(el('div', { class: 'seg' }, [
    el('button', { onclick: jump('sec-log') }, '💞 Plan & log'),
    el('button', { onclick: jump('sec-booked') }, '✅ Booked'),
    el('button', { onclick: jump('sec-planning') }, '🔨 Planning'),
  ]));

  const t = todayStr();
  const upcoming = DB.entries.filter((e) => !e.deleted && (e.planned || e.date > t)).sort((a,b) => a.date < b.date ? -1 : 1);
  const bookedList = upcoming.filter((e) => e.status === 'booked');
  const planningList = upcoming.filter((e) => e.status !== 'booked');
  // Special dates surface only when they're close — clean the rest of the year.
  const nearSpecial = SPECIAL.map((s) => ({ s, nx: nextSpecial(s) })).filter((x) => x.nx.left <= 45).sort((a,b) => a.nx.left - b.nx.left);

  view.append(el('h2', { id: 'sec-log' }, 'Plan & log'));
  // Compact status boxes, one per cadence. Tap = straight into picking a
  // date (plans-forward first); details come later from the event itself.
  view.append(el('div', { class: 'statgrid' }, CADENCES.map((c) => {
    const last = lastDone(c.type);
    const planned = nextPlanned(c.type);

    // Status speaks the ladder (planning/booked); the concrete countdown to
    // a calendared event sits on the right in green.
    let status, cls, count = '';
    if (planned) {
      const until = daysBetween(t, planned.date);
      count = until === 0 ? 'today!' : until === 1 ? 'tmrw!' : until < 0 ? `${-until}d ago` : `${until}d`;
      status = planned.status === 'booked' ? '✅ booked' : '🔨 planning';
      cls = planned.status === 'booked' ? 'ok' : 'due';
    }
    else if (!c.days) { status = 'anytime'; cls = 'ok'; }
    else if (!last) { status = 'let’s start'; cls = 'due'; }
    else {
      const left = daysBetween(todayStr(), addDays(last.date, c.days));
      status = left < 0 ? `${-left}d overdue` : left === 0 ? 'due today' : `due in ${left}d`;
      cls = left <= 3 ? 'due' : 'ok';
    }
    const pt = planned ? shownVal(planned, 'title') : null;
    const lockPre = planned && ownerHidden(planned).length ? '🔒 ' : '';
    const meta = planned
      ? `${lockPre}${pt === null ? '🔒 surprise' : pt || 'planned'} · ${fmt(planned.date)}`
      : last ? `last: ${fmt(last.date)}` : 'no history yet';

    return el('button', { class: 'stat', onclick: () => logModal(c.type, { planned: true }) }, [
      el('span', { class: 's-emoji' }, c.emoji),
      el('span', { class: 's-name' }, c.title),
      el('span', { class: 's-statusrow' }, [
        el('span', { class: 's-status ' + cls }, status),
        count ? el('span', { class: 's-count' }, count) : null,
      ]),
      el('span', { class: 's-meta' }, meta),
    ]);
  })));

  view.append(el('h2', { id: 'sec-booked' }, '✅ Booked'));
  if (nearSpecial.length) for (const { s, nx } of nearSpecial) {
    view.append(el('div', { class: 'row rec', onclick: () => stashSheet(s), title: 'Your private scratchpad for this one' }, [
      el('span', { class: 'r-emoji' }, s.emoji),
      el('div', { class: 'r-main' }, [
        el('div', { class: 'r-title' }, s.since ? `${s.label} — ${nx.years} years` : `${s.label}’s birthday`),
        el('div', { class: 'r-meta' }, `${fmt(nx.date)} · 🎁 tap for your private idea stash`),
      ]),
      el('span', { class: 'chip love' }, nx.left === 0 ? 'today! 🎉' : `in ${nx.left}d`),
    ]));
  }
  if (!bookedList.length && !nearSpecial.length) view.append(el('p', { class: 'muted small' }, 'Nothing locked in yet — when a plan is set, mark it ✅ booked.'));
  for (const e of bookedList) view.append(upcomingCard(e));

  view.append(el('h2', { id: 'sec-planning' }, '🔨 Still planning'));
  if (!planningList.length) view.append(el('p', { class: 'muted small' }, 'Nothing in the works — tap ＋ Plan ahead above, or raid the Ideas tab.'));
  for (const e of planningList) view.append(upcomingCard(e));
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
    const all = RECS.filter((r) => ideaFilter === 'all' || r.type === ideaFilter);
    const visible = all.filter((r) => recState(r) !== 'dismissed' || showDismissedRecs);
    const hidden = all.length - all.filter((r) => recState(r) !== 'dismissed').length;
    // Done picks sink to the bottom; dismissed ones disappear unless shown.
    visible.sort((a, b) => (recState(a) === 'done' ? 1 : 0) - (recState(b) === 'done' ? 1 : 0));
    view.append(el('h2', {}, 'Curated picks'));
    view.append(el('p', { class: 'muted small', style: 'margin: -4px 0 10px' }, 'Hand-researched, no API needed. Tap one for the full story.'));
    for (const r of visible) {
      const c = cadenceOf(r.type);
      const st = recState(r);
      view.append(el('div', { class: 'row rec' + (st === 'done' ? ' done' : ''), onclick: () => recModal(r) }, [
        el('span', { class: 'r-emoji' }, st === 'done' ? '✓' : c.emoji),
        el('div', { class: 'r-main' }, [
          el('div', { class: 'r-title' }, `${r.name} · ${starStr(r.stars)}`),
          el('div', { class: 'r-meta' }, `${r.area} — ${r.why}`),
        ]),
        st === 'dismissed'
          ? el('button', { class: 'btn btn-sm', onclick: (ev) => { ev.stopPropagation(); setRecState(r, ''); } }, '↩ restore')
          : el('button', { class: 'btn btn-ghost btn-sm', title: 'Not for us', onclick: (ev) => { ev.stopPropagation(); setRecState(r, 'dismissed'); toast('Hidden — restore anytime below'); } }, '✕'),
      ]));
    }
    if (hidden) view.append(el('button', { class: 'btn btn-ghost btn-sm', onclick: () => { showDismissedRecs = !showDismissedRecs; render(); } },
      showDismissedRecs ? 'Hide dismissed' : `${hidden} dismissed · show`));
  }
}

const starStr = (s) => '★'.repeat(Math.floor(s)) + (s % 1 ? '½' : '');
let showDismissedRecs = false;
const recId = (r) => 'rec:' + r.name;
function recState(r) { return DB.recstate.find((x) => x.id === recId(r))?.state || ''; }
function setRecState(r, state) {
  const x = DB.recstate.find((y) => y.id === recId(r));
  if (x) { x.state = state; x.updatedAt = now(); }
  else DB.recstate.push({ id: recId(r), state, updatedAt: now() });
  commit(); render();
}

function recModal(r) {
  const c = cadenceOf(r.type);
  const deeper = el('div', {});
  const cacheKey = 'rec:' + r.name;
  const showDeep = (d) => clear(deeper).append(
    el('p', { class: 'small', style: 'background: var(--surface-2); border-radius: 12px; padding: 12px; margin-bottom: 4px' }, d.text),
    el('p', { class: 'muted small', style: 'margin:0' }, `✨ saved ${fmt(d.at.slice(0, 10))}`),
  );
  // A paid deep-dive shows instantly for ~30 days; the button becomes refresh.
  if (DB.deepcache[cacheKey]) showDeep(DB.deepcache[cacheKey]);
  const body = [
    el('p', { class: 'muted small', style: 'margin:0' }, `${c.emoji} ${c.title} · ${r.area} · ${starStr(r.stars)}`),
    el('p', {}, r.why),
    el('p', { class: 'muted' }, r.more),
    lookupLinks(`${r.name} ${r.area}`, r.type),
    deeper,
  ];
  const actions = [
    el('button', { class: 'btn', onclick: () => m.close() }, 'Close'),
    el('button', { class: 'btn btn-sm', title: 'We did this one', onclick: () => { m.close(); setRecState(r, recState(r) === 'done' ? '' : 'done'); toast(recState(r) === 'done' ? '✓ Been there' : 'Back on the list'); } }, recState(r) === 'done' ? '↩ not done' : '✓ Did it'),
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
          `A married couple near ${s.city || 'Chandler/Gilbert, AZ (southeast Phoenix valley)'} is considering this for a ${c.title.toLowerCase()}: ${r.name} (${r.area}). ${r.why} Give a short, practical deeper take: best time to go, 2-3 insider tips, what to book ahead, rough cost feel. Under 120 words, plain prose, no headers. Don't invent event dates.` }] }),
      });
      if (!res.ok) throw new Error('Claude ' + res.status);
      const json = await res.json();
      const d = { text: (json.content || []).filter((x) => x.type === 'text').map((x) => x.text).join('').trim(), at: now() };
      DB.deepcache[cacheKey] = d; save(DB);
      showDeep(d);
      b.disabled = false; b.textContent = '↻ Refresh take';
    } catch (err) { toast('Deep dive failed: ' + err.message); b.disabled = false; b.textContent = '✨ Go deeper'; }
  } }, DB.deepcache[cacheKey] ? '↻ Refresh take' : '✨ Go deeper'));
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
const MEM_ICONS = { moment: '💫', food: '🍴', drink: '🍸', activity: '🥾', gift: '🎁' };
function memLine(e) {
  if (!e.mem) return null;
  const bits = Object.entries(e.mem).filter(([, v]) => v).map(([k, v]) => `${MEM_ICONS[k] || '•'} ${v}`);
  return bits.length ? el('div', { class: 'r-meta' }, bits.join('  ')) : null;
}
function historyRow(e, upcoming) {
  const c = cadenceOf(e.type);
  // Pills sit on their own bottom line so titles get the full width, and the
  // upcoming chip speaks the ladder (planning/booked), same as everywhere else.
  const chip = e.rating
    ? el('span', { class: 'chip love' }, '♥'.repeat(e.rating))
    : upcoming
      ? el('span', { class: 'chip' + (e.status === 'booked' ? ' love' : '') }, e.status === 'booked' ? '✅ booked' : '🔨 planning')
      : null;
  return el('div', { class: 'row hrow' }, [
    el('span', { class: 'r-emoji' }, c.emoji),
    el('div', { class: 'r-main' }, [
      el('div', { class: 'r-title' }, titleText(e)),
      el('div', { class: 'r-meta' }, `${whenWhere(e)}${notesSuffix(e)}`),
      memLine(e),
      lockBadge(e),
    ]),
    el('button', { class: 'btn btn-ghost btn-sm', title: 'Edit', onclick: () => logModal(e.type, { entry: e }) }, '✎'),
    el('button', { class: 'btn btn-ghost btn-sm', title: 'Delete', onclick: () => { e.deleted = true; e.updatedAt = now(); commit(); render(); } }, '✕'),
    chip ? el('div', { class: 'r-bottom' }, chip) : null,
  ]);
}

// ---------- log / plan / edit modal ----------
// Memory questions per cadence — the stuff worth remembering later.
const MEMQ = {
  date:     [['moment', 'Favorite moment'], ['food', 'Favorite food'], ['drink', 'Favorite drink']],
  getaway:  [['activity', 'Favorite activity'], ['food', 'Favorite food'], ['moment', 'A moment to keep']],
  trip:     [['activity', 'Favorite activity'], ['food', 'Favorite food'], ['moment', 'A moment to keep']],
  occasion: [['moment', 'Favorite moment'], ['food', 'Favorite food'], ['gift', 'Best gift or surprise']],
};
const PLAN_LEAD = { date: 14, getaway: 45, trip: 180, occasion: 30 }; // getaways & trips get planned early
// Planning details per cadence — the stuff worth knowing before you go.
const PLANQ = {
  date:     [['loc', 'Location'], ['time', 'Time'], ['dress', 'Dress code']],
  occasion: [['loc', 'Location'], ['time', 'Time'], ['dress', 'Dress code']],
  getaway:  [['loc', 'Location'], ['dateEnd', 'Through (last day)'], ['pack', 'What to pack']],
  trip:     [['loc', 'Location'], ['dateEnd', 'Through (last day)'], ['pack', 'What to pack']],
};
const PLAN_HINT = { title: 'Name it — “Odyssey at Harkins”', loc: 'Where is it?', dress: 'casual / dressy / fancy', pack: 'Swimsuits, sunscreen, hiking shoes…', notes: 'Anything worth remembering' };
const FIELD_TYPE = { time: 'time', dateEnd: 'date' };
function logModal(type, { planned = false, prefill = '', ideaId = null, entry = null } = {}) {
  const c = cadenceOf(type);
  if (entry) planned = Boolean(entry.planned);
  const date = el('input', { class: 'input', type: 'date', value: entry ? entry.date : planned ? addDays(todayStr(), PLAN_LEAD[type]) : todayStr() });
  const body = [el('label', { class: 'field-label' }, planned ? 'Planned date' : 'Date'), date];

  // Hideable fields carry a 🔒 toggle. A locked field's value is written to
  // DB.secrets (this device only); the synced entry keeps just the key in
  // entry.hidden. On the partner's phone the field shows a read-only 🔒
  // teaser and is left untouched on save, so a merge from their edits can
  // never wipe your secret. Editing a PAST entry keeps the toggles too —
  // that's how a surprise gets revealed after it happens (tap 🔒 off).
  const inputs = {}, locked = {};
  const canHide = planned || Boolean(entry);
  function field(k, labelText, { textarea = false } = {}) {
    // Partner's surprise: no input, nothing to save, just the teaser.
    if (entry && (entry.hidden || []).includes(k) && !iOwnSecret(entry, k)) {
      body.push(el('label', { class: 'field-label' }, labelText), el('div', { class: 'input locked-note' }, '🔒 Kept as a surprise 💝'));
      return;
    }
    const val = entry ? (shownVal(entry, k) || '') : (k === 'title' ? prefill : '');
    const hint = k === 'title' && !planned ? 'What did you do? (optional)' : PLAN_HINT[k] || 'optional';
    const input = textarea
      ? el('textarea', { class: 'input', placeholder: hint }, val)
      : el('input', { class: 'input', type: FIELD_TYPE[k] || 'text', placeholder: hint, value: val });
    inputs[k] = input;
    let lab;
    if (canHide) {
      locked[k] = entry ? iOwnSecret(entry, k) : false;
      const mark = el('span', { class: 'lockmark' }, locked[k] ? `🔒 hidden from ${partnerName()}` : '');
      const sync = () => { input.classList.toggle('locked', locked[k]); mark.textContent = locked[k] ? `🔒 hidden from ${partnerName()}` : ''; };
      const lock = el('button', { type: 'button', class: 'lockmini' + (locked[k] ? ' on' : ''), title: 'Keep this a surprise', onclick: () => {
        locked[k] = !locked[k]; lock.classList.toggle('on', locked[k]); lock.textContent = locked[k] ? '🔒' : '🔓'; sync();
      } }, locked[k] ? '🔒' : '🔓');
      lab = el('label', { class: 'field-label lockrow' }, [el('span', {}, [labelText, ' ', mark]), lock]);
      if (locked[k]) input.classList.add('locked');
    } else lab = el('label', { class: 'field-label' }, labelText);
    body.push(lab, input);
  }

  field('title', 'Title');
  // Detail fields show on plans AND when editing any existing entry — a past
  // event's location is worth recording, and a graduated surprise needs its
  // fields visible to be unlockable. Only a fresh log stays lean.
  if (planned || entry) for (const [k, label] of PLANQ[type]) field(k, label);
  // A known location gets lookup links — menus/prices, map & hours, reviews.
  const knownLoc = entry && shownVal(entry, 'loc');
  if (knownLoc) body.push(lookupLinks(knownLoc, type));
  field('notes', 'Notes');

  // Memories + rating make sense once it's happened (or when editing a past entry).
  const showExtras = !planned || (entry && entry.date <= todayStr());
  const memInputs = {};
  if (showExtras) {
    for (const [k, label] of MEMQ[type]) {
      memInputs[k] = el('input', { class: 'input', placeholder: 'optional', value: entry?.mem?.[k] || '' });
      body.push(el('label', { class: 'field-label' }, label), memInputs[k]);
    }
    let rating = entry ? (entry.rating || 0) : 0;
    var getRating = () => rating;
    const stars = [1,2,3,4,5].map((n) => el('button', { class: n <= rating ? 'on' : '', onclick: () => { rating = rating === n ? 0 : n; stars.forEach((s,i) => s.classList.toggle('on', i < rating)); } }, '♥'));
    body.push(el('div', {}, [el('label', { class: 'field-label' }, 'How was it?'), el('div', { class: 'rating' }, stars)]));
  }

  if (canHide) body.push(el('p', { class: 'muted small', style: 'margin:12px 0 0' }, '🔒 = kept a surprise: stays on this phone only, shows the other of you a locked teaser.'));
  if (!entry && planned) body.push(el('p', { style: 'margin:10px 0 0' },
    el('button', { class: 'linklike', onclick: () => { m.close(); logModal(type, { prefill: inputs.title?.value || '', ideaId }); } }, '✓ …or log one that already happened')));

  // Commit inputs onto an entry, routing locked fields to DB.secrets.
  function apply(e) {
    e.date = date.value || e.date || todayStr();
    const hidden = [];
    const sec = DB.secrets[e.id] || {};
    for (const k of HIDEABLE) {
      if (!(k in inputs)) { if ((e.hidden || []).includes(k)) hidden.push(k); continue; } // partner-hidden: preserve
      const v = inputs[k].value.trim();
      if (canHide && locked[k]) { sec[k] = v; e[k] = ''; hidden.push(k); }
      else { delete sec[k]; e[k] = v; }
    }
    if (Object.keys(sec).length) DB.secrets[e.id] = sec; else delete DB.secrets[e.id];
    e.hidden = hidden;
    if (showExtras) {
      const mem = {};
      for (const [k] of MEMQ[type]) if (memInputs[k]?.value.trim()) mem[k] = memInputs[k].value.trim();
      e.mem = mem; e.rating = getRating();
    }
    e.updatedAt = now();
  }

  const heading = entry
    ? (planned ? `${c.emoji} ${titleText(entry)}` : `Edit ${c.title.toLowerCase()}`)
    : planned ? `Plan a ${c.title.toLowerCase()}` : `Log a ${c.title.toLowerCase()}`;

  const saveNew = (status) => {
    const e = { id: uid(), type, planned, status, deleted: false };
    apply(e);
    DB.entries.push(e);
    if (ideaId) { const it = DB.ideas.find((x) => x.id === ideaId); if (it) { it.done = true; it.updatedAt = now(); } }
    commit(); m.close();
    toast(planned ? (status === 'booked' ? 'Booked 💞' : 'Added to Coming up 💞') : 'Logged — nice 💞');
    render();
  };
  const saveEdit = () => {
    apply(entry);
    // Strictly past → graduate to history. Today stays upcoming — editing a
    // plan the morning-of (adding the time, say) must not bury it pre-event.
    if (entry.planned && entry.date < todayStr()) entry.planned = false;
    commit(); m.close(); toast('Updated 💞'); render();
  };
  const remove = () => {
    entry.deleted = true; entry.updatedAt = now(); delete DB.secrets[entry.id];
    commit(); m.close(); toast('Removed'); render();
  };

  let actions;
  if (entry) actions = [
    el('button', { class: 'btn btn-ghost btn-danger-text', title: 'Remove this', onclick: remove }, '🗑 Remove'),
    el('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'),
    el('button', { class: 'btn btn-primary', onclick: saveEdit }, 'Save'),
  ];
  else if (planned) actions = [
    el('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'),
    el('button', { class: 'btn btn-primary', onclick: () => saveNew('planning') }, 'Just plan it'),
    el('button', { class: 'btn', onclick: () => saveNew('booked') }, '✅ Book it'),
  ];
  else actions = [
    el('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'),
    el('button', { class: 'btn btn-primary', onclick: () => saveNew(undefined) }, 'Log it'),
  ];

  const m = modal(heading, body, actions);
  inputs.title?.focus();
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
let freeTaps = 0, freeTimer;
function renderBingo() {
  const deep = current === 'bingo2';
  const col = deep ? DB.bingo2 : DB.bingo;
  const items = deep ? BINGO2_ITEMS : BINGO_ITEMS;
  view.append(
    el('h1', {}, deep ? 'After dark 🔥' : 'Just us 💗'),
    el('p', { class: 'sub' }, deep
      ? 'The card behind the card. Same rules, higher temperature — everything optional, everything discussed, nothing rushed.'
      : 'You found it. Twenty-five little ways to stay close — mark them together, get five in a row.'),
  );
  view.append(el('button', { class: 'btn btn-ghost btn-sm', style: 'margin-bottom:12px', onclick: () => { current = deep ? 'bingo' : 'rhythm'; setTab(); render(); } }, '← back'));

  const doneSet = new Set(col.filter((b) => b.done).map((b) => b.n));
  const wins = bingoLines(doneSet);
  const inWin = new Set(wins.flat());
  if (wins.length) view.append(el('p', { class: 'small', style: 'font-weight:700; color: var(--accent)' }, `BINGO × ${wins.length} 🎉`));

  const cells = col.slice().sort((a,b) => a.n - b.n).map((b) => {
    const free = b.n === BINGO_FREE;
    const label = free ? (deep ? 'FREE — you know what to do 🔥' : 'FREE — kiss right now 💋') : items[b.n < BINGO_FREE ? b.n : b.n - 1];
    return el('button', {
      class: 'bcell' + (b.done ? ' done' : '') + (inWin.has(b.n) ? ' win' : ''),
      onclick: () => {
        if (free) {
          // The free square of the sweet card hides the door to the second one:
          // 6 taps earns a "keep going", 6 more opens it.
          if (!deep) {
            freeTaps++;
            clearTimeout(freeTimer);
            freeTimer = setTimeout(() => { freeTaps = 0; }, 2000);
            if (freeTaps >= 12) { freeTaps = 0; current = 'bingo2'; render(); return; }
            toast(freeTaps < 6 ? 'That one’s always free 💋' : freeTaps === 6 ? '…keep going 👀' : '👀' + '🔥'.repeat(freeTaps - 6));
          } else toast('Always free 🔥');
          return;
        }
        b.done = !b.done; b.updatedAt = now(); commit();
        const nowWins = bingoLines(new Set(col.filter((x) => x.done).map((x) => x.n))).length;
        if (b.done && nowWins > wins.length) toast(deep ? 'BINGO. Well then 🔥' : 'BINGO! You two 🎉💞');
        render();
      },
    }, label);
  });
  view.append(el('div', { class: 'bingo' + (deep ? ' deep' : '') }, cells));
  view.append(el('p', { class: 'muted small center', style: 'margin-top:14px' }, deep
    ? 'Synced between your phones. A safeword and a sense of humor cover everything else.'
    : 'Synced between your phones. No pressure, no order — just excuses to reach for each other.'));
}

// ---------- settings (a real tab since v15) ----------
function renderSettings() {
  const s = DB.settings;
  const apiKey = el('input', { class: 'input', type: 'password', placeholder: 'sk-ant-…', value: s.apiKey || '' });
  const city = el('input', { class: 'input', placeholder: 'e.g. Chandler, AZ', value: s.city || '' });
  const interests = el('input', { class: 'input', placeholder: 'e.g. live music, tacos, hiking, comedy', value: s.interests || '' });
  const themeSel = el('select', { class: 'input' }, ['auto','light','dark'].map((v) => el('option', { value: v, selected: (s.theme||'auto')===v ? 'selected' : null }, v[0].toUpperCase()+v.slice(1))));
  const whoSel = el('select', { class: 'input' }, [['', 'Choose…'], ['chris', '💙 Chris'], ['kat', '💜 Kat']].map(([v, label]) => el('option', { value: v, selected: (s.who || '') === v ? 'selected' : null }, label)));
  const couponHook = el('input', { class: 'input', placeholder: 'https://script.google.com/macros/s/…/exec', value: s.couponHook || '' });
  const gistToken = el('input', { class: 'input', type: 'password', placeholder: 'GitHub token (gist scope)', value: s.gistToken || '' });
  const gistId = el('input', { class: 'input', placeholder: 'Gist ID', value: s.gistId || '' });
  const syncLine = el('p', { class: 'muted small', style: 'margin:6px 0 0' },
    s.gistToken && s.gistId ? `Sync configured${s.lastSyncAt ? ' · last synced ' + new Date(s.lastSyncAt).toLocaleString() : ''}` : 'Same setup as Home OS: both phones use the same private Gist + token. 🔒 Private ideas never leave this device.');

  view.append(
    el('h1', {}, 'Settings'),
    el('p', { class: 'sub' }, 'Everything on this page stays on this phone — none of it syncs.'),
    el('div', { class: 'card' }, [
      el('label', { class: 'field-label', style: 'margin-top:0' }, 'This phone belongs to'), whoSel,
      el('p', { class: 'muted small', style: 'margin:6px 0 0' }, 'Picks whose 💌 coupon book you send from.'),
      el('label', { class: 'field-label' }, 'Home city (sharpens ideas)'), city,
      el('label', { class: 'field-label' }, 'What you two enjoy'), interests,
      el('label', { class: 'field-label' }, 'Claude API key (optional — for ✨ idea suggestions)'), apiKey,
      el('p', { class: 'muted small', style: 'margin:6px 0 0' }, 'Get one at console.anthropic.com.'),
      el('label', { class: 'field-label' }, 'Coupon email nudge (optional — Apps Script URL)'), couponHook,
      el('p', { class: 'muted small', style: 'margin:6px 0 0' }, 'Emails the other of you a teaser when a coupon is sent. Setup steps: COUPON_EMAIL.md in the repo.'),
      el('label', { class: 'field-label' }, 'Shared sync (optional — private Gist)'), gistToken, el('div', { style: 'height:8px' }), gistId,
      syncLine,
      el('div', { style: 'margin-top:10px' }, el('button', { class: 'btn btn-sm', onclick: () => syncNow(true) }, '⇅ Sync now')),
      el('label', { class: 'field-label' }, 'Appearance'), themeSel,
      el('div', { style: 'margin-top:16px' }, el('button', { class: 'btn btn-primary', onclick: () => {
        DB.settings = { ...DB.settings, who: whoSel.value, apiKey: apiKey.value.trim(), city: city.value.trim(), interests: interests.value.trim(), theme: themeSel.value, couponHook: couponHook.value.trim(), gistToken: gistToken.value.trim(), gistId: gistId.value.trim() };
        commit(); applyTheme(); toast('Saved'); render();
      } }, 'Save')),
    ]),
    el('p', { class: 'muted small center', style: 'margin:16px 0 0' }, `Us OS · ${APP_VERSION}`),
  );
}
const hasKey = () => Boolean(DB.settings.apiKey);

// ---------- gist sync (shared with Kat; same model as Home OS) ----------
// One private Gist, one JSON file; both phones merge per-record by id,
// newest updatedAt wins; tombstones keep deletions deleted. PRIVATE ideas
// are stripped from the payload before it ever leaves the device.
const GIST_FILE = 'ortiz-us-os.json';
function sharedPayload() {
  // Coupons need no privacy filter: only sent ones exist as records at all —
  // the unsent book is static code, so it can't leak.
  return { entries: DB.entries, ideas: DB.ideas.filter((i) => !i.private), tickets: DB.tickets, coupons: DB.coupons, bingo: DB.bingo, bingo2: DB.bingo2, recstate: DB.recstate, savedAt: now() };
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
      DB.coupons = mergeCol(DB.coupons, remote.coupons);
      DB.bingo = mergeCol(DB.bingo, remote.bingo);
      DB.bingo2 = mergeCol(DB.bingo2, remote.bingo2);
      DB.recstate = mergeCol(DB.recstate, remote.recstate);
      // A not-yet-updated phone may still mark legacy coupon tickets — fold
      // any that arrived via merge into coupon records.
      migrateCoupons();
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
    maybeReveal(); // a sheet that just synced in a coupon deserves the moment
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
      + ` They live in ${s.city || 'the Chandler/Gilbert area (southeast Phoenix valley)'} — name real venues, neighborhoods, and destinations near there, the kind of thing locals actually do.`
      + (type === 'date' ? ` ${IDEA_SCOPE.date}` : '')
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
migrateCoupons();
render();
maybeReveal(); // a coupon synced in while the app was closed still gets its moment
syncNow(false); // pull the other phone's changes on open
// Coming back to the app (phone unlock, tab switch) is the natural moment
// the other phone's changes matter — re-sync quietly.
document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleSync(); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
