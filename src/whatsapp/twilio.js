// Twilio WhatsApp client + TwiML reply helpers
require('dotenv').config();
const twilio = require('twilio');

const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

let client = null;
if (sid && token && sid.startsWith('AC')) {
  client = twilio(sid, token);
}

// TwiML response for instant reply via webhook
function twimlReply(message) {
  const escaped = String(message)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>${escaped}</Message></Response>`;
}

// Send a proactive message (e.g. admin notification) — requires Twilio creds
async function sendMessage(to, body) {
  if (!client) {
    console.warn('[twilio] client not configured; would send:', to, body.slice(0, 80));
    return null;
  }
  return client.messages.create({ from: FROM, to, body });
}

module.exports = { twimlReply, sendMessage };
