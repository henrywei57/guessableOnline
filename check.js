import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const TARGET_URL = process.env.TARGET_URL || 'https://beta.guessable.gg/';
const STATUS_FILE = fileURLToPath(new URL('./status.json', import.meta.url));
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO || 'henry.wh.wei@gmail.com';
const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM || 'Guessable Monitor <onboarding@resend.dev>';
const TIMEOUT_MS = 15000;

async function checkSite() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(TARGET_URL, { signal: controller.signal, redirect: 'follow' });
    // Anything >=500 (502 in particular) means the site is effectively down.
    return { up: res.status < 500, statusCode: res.status, error: null };
  } catch (err) {
    return { up: false, statusCode: null, error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

async function readPreviousStatus() {
  try {
    const raw = await readFile(STATUS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { up: false, lastStatusCode: null, lastCheckedAt: null, lastChangedAt: null };
  }
}

async function sendAlertEmail(statusCode) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set; skipping email alert.');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: ALERT_EMAIL_FROM,
      to: [ALERT_EMAIL_TO],
      subject: 'guessable.gg beta is back online',
      text: `${TARGET_URL} responded with status ${statusCode} at ${new Date().toISOString()}. It appears to be accessible again.`,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
  console.log('Alert email sent.');
}

async function main() {
  const previous = await readPreviousStatus();
  const result = await checkSite();
  const now = new Date().toISOString();

  console.log(
    `Checked ${TARGET_URL}: up=${result.up} statusCode=${result.statusCode ?? 'n/a'} error=${result.error ?? 'none'}`
  );

  const cameBackOnline = result.up && !previous.up;

  if (cameBackOnline) {
    console.log('Site transitioned from down to up — sending alert email.');
    await sendAlertEmail(result.statusCode);
  }

  const newStatus = {
    up: result.up,
    lastStatusCode: result.statusCode,
    lastError: result.error,
    lastCheckedAt: now,
    lastChangedAt: result.up !== previous.up ? now : previous.lastChangedAt ?? now,
  };

  await writeFile(STATUS_FILE, JSON.stringify(newStatus, null, 2) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
