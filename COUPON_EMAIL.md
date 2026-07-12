# 💌 Coupon email nudge — setup

When one of you sends a love coupon, the app can also email the other a
little teaser ("something's waiting for you…") — the coupon itself is only
revealed in the app. This uses a free Google Apps Script on your own Google
account: no third-party service, no server, and the email genuinely comes
from your Gmail.

The nudge is strictly optional and best-effort: the coupon always travels by
Gist sync. If the email fails or the URL isn't configured, the coupon still
arrives in the app.

## One-time setup (~10 minutes, one of you does it once)

1. Go to <https://script.google.com> (signed in as either of you) and click
   **New project**.
2. Replace the contents of `Code.gs` with the script below, and fill in
   **both real email addresses** at the top.
3. Click **Deploy → New deployment**, choose type **Web app**, and set:
   - **Execute as:** Me
   - **Who has access:** Anyone
     (the URL is long and unguessable; the worst anyone who found it could
     do is email the two of you a teaser — it can't read or leak anything)
4. Click **Deploy**, authorize when prompted, and copy the **Web app URL**
   (it ends in `/exec`).
5. In Us OS on **both phones**: Settings → *Coupon email nudge* → paste the
   URL. While you're there, make sure *This phone belongs to* is set on each
   phone (that's also what makes coupon sending work at all).

To change the wording later: edit the script, then **Deploy → Manage
deployments → ✎ → New version**. The URL stays the same.

## The script (`Code.gs`)

```js
// Us OS love-coupon teaser. The app POSTs {"from":"chris"|"kat"}; this
// emails the OTHER person a nudge. The coupon itself never appears here —
// the reveal happens in the app.
const EMAILS = {
  chris: 'chris.ortiz@gmail.com',
  kat: 'KATS-EMAIL-HERE@gmail.com', // ← fill in
};
const NAMES = { chris: 'Chris', kat: 'Kat' };
const APP_URL = 'https://ortizzle.github.io/ortiz-us-os/';

function doPost(e) {
  let from = '';
  try { from = JSON.parse(e.postData.contents).from; } catch (err) {}
  if (!EMAILS[from]) return ContentService.createTextOutput('nope');
  const to = from === 'chris' ? 'kat' : 'chris';

  MailApp.sendEmail({
    to: EMAILS[to],
    subject: `💌 ${NAMES[to]}, something's waiting for you`,
    htmlBody: `
      <div style="background:#fbf7f8;padding:32px 16px;font-family:-apple-system,'Segoe UI',system-ui,sans-serif;">
        <div style="max-width:420px;margin:0 auto;background:#ffffff;border:1px solid #ece3e6;border-radius:18px;padding:36px 28px;text-align:center;">
          <div style="font-size:44px;line-height:1;">💌</div>
          <h1 style="font-size:22px;letter-spacing:-0.01em;color:#23191c;margin:14px 0 6px;">
            You've got a love coupon
          </h1>
          <p style="font-size:15px;color:#7d6b71;margin:0 0 24px;line-height:1.5;">
            ${NAMES[from]} just sent you one.<br>What is it? Only one way to find out.
          </p>
          <a href="${APP_URL}"
             style="display:inline-block;background:#d1476b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 26px;border-radius:999px;">
            Open Us OS
          </a>
          <p style="font-size:12px;color:#b39aa2;margin:26px 0 0;">
            Sent with love, automatically — Ortiz Us OS
          </p>
        </div>
      </div>`,
    body: `${NAMES[from]} just sent you a love coupon. Open Us OS to see it: ${APP_URL}`,
  });
  return ContentService.createTextOutput('ok');
}
```

## How the app calls it

`sendCouponNudge()` in `app.js` POSTs `{"from":"chris"}` (or `"kat"`) as
`text/plain` — a "simple" request, because Apps Script can't answer CORS
preflights. The script decides the recipient from its own hardcoded list, so
no email addresses live in the app or the Gist.

## Troubleshooting

- **No email arrives:** re-check the deployment is the *latest version*, set
  to *Execute as: Me* and *Anyone* access, and that the URL on the phone ends
  in `/exec` (not `/dev`). Check Gmail spam the first time.
- **"the email nudge didn't go through" toast:** usually a typo'd URL or the
  phone was offline at that moment. The coupon itself still arrived in-app.
- **Daily limits:** a plain Gmail account can send ~100 script emails/day —
  effectively unlimited for this.
