const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return transporter;
}

async function sendResetCode(toEmail, code) {
  const tr = getTransporter();
  // Dev fallback: no SMTP configured — log and still resolve so flow can be tested.
  if (!tr) {
    console.log(`[auth] SMTP not configured — reset code for ${toEmail}: ${code}`);
    return { delivered: false, previewCode: process.env.NODE_ENV !== 'production' ? code : undefined };
  }
  // Timeouts so a slow/blocked SMTP server can never hang the /forgot-password
  // request (which is what stuck the app on "Sending...").
  tr.options.connectionTimeout = 8000;
  tr.options.greetingTimeout = 8000;
  tr.options.socketTimeout = 10000;
  await tr.sendMail({
    from: `"My Diary" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Your diary password reset code',
    text:
      `Your password reset code is: ${code}\n\n` +
      `It expires in 10 minutes.\n` +
      `If you didn't request this, ignore this email.\n\n` +
      `Note: resetting your password will permanently delete your old encrypted diary entries, because they can only be decrypted with the old password.`,
  });
  return { delivered: true };
}

module.exports = { sendResetCode };
