// Brevo HTTP API first (works on Render — plain HTTPS, never blocked),
// Gmail SMTP fallback (often gets Connection timeout on Render free tier).
// Env needed for Brevo: BREVO_API_KEY + SENDER_EMAIL (verified sender in Brevo).

async function sendViaBrevo(toEmail, code) {
  const apiKey = process.env.BREVO_API_KEY;
  const sender = process.env.SENDER_EMAIL || process.env.SMTP_USER;
  if (!apiKey || !sender) return null;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: { name: 'My Diary', email: sender },
      to: [{ email: toEmail }],
      subject: 'Your diary password reset code',
      textContent:
        `Your password reset code is: ${code}\n\n` +
        `It expires in 10 minutes.\n` +
        `If you didn't request this, ignore this email.\n\n` +
        `Note: diary entries are encrypted with your old password, so entries written before the reset can't be opened with the new password.`,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo ${res.status}: ${body.slice(0, 200)}`);
  }
  return { delivered: true, via: 'brevo' };
}

function getTransporter() {
  // Lazy-require so the server boots even without nodemailer installed.
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (_) {
    return null;
  }
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  const tr = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  tr.options.connectionTimeout = 8000;
  tr.options.greetingTimeout = 8000;
  tr.options.socketTimeout = 10000;
  return tr;
}

async function sendResetCode(toEmail, code) {
  // 1) Brevo HTTP — preferred on Render.
  try {
    const r = await sendViaBrevo(toEmail, code);
    if (r) return r;
  } catch (e) {
    console.error('Brevo send failed:', e.message);
    // fall through to SMTP attempt below
  }
  // 2) Gmail SMTP fallback.
  const tr = getTransporter();
  if (!tr) {
    console.log(`[auth] No mail provider configured — reset code for ${toEmail}: ${code}`);
    return { delivered: false, previewCode: process.env.NODE_ENV !== 'production' ? code : undefined };
  }
  await tr.sendMail({
    from: `"My Diary" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Your diary password reset code',
    text:
      `Your password reset code is: ${code}\n\n` +
      `It expires in 10 minutes.\n` +
      `If you didn't request this, ignore this email.\n\n` +
      `Note: diary entries are encrypted with your old password, so entries written before the reset can't be opened with the new password.`,
  });
  return { delivered: true, via: 'smtp' };
}

module.exports = { sendResetCode };
