// Instagram comment auto-reply via webhook
// Setup:
//  1. Add webhook in Facebook App → Instagram → Subscriptions: "comments"
//  2. Verify token = IG_VERIFY_TOKEN env
//  3. On comment received, this module replies based on keywords.

require('dotenv').config();
const axios = require('axios');

const TOKEN = process.env.IG_ACCESS_TOKEN;
const GRAPH = 'https://graph.facebook.com/v20.0';
const WA_NUMBER = (process.env.ADMIN_WHATSAPP || '').replace(/^whatsapp:\+?/, '');

const KEYWORDS = [
  { match: /\b(price|rate|kitna|kitne|cost)\b/i,
    reply: '💰 Chicken from ₹260/kg, Mutton from ₹800/kg, Fish from ₹280/kg. Full menu on WhatsApp 👉 wa.me/' + WA_NUMBER },
  { match: /\b(order|book|chahiye|want|buy)\b/i,
    reply: '🛒 Order in 30 sec on WhatsApp 👉 wa.me/' + WA_NUMBER },
  { match: /\b(menu|items|list)\b/i,
    reply: '📋 Send "hi" on our WhatsApp to view full menu 👉 wa.me/' + WA_NUMBER },
  { match: /\b(delivery|deliver|free)\b/i,
    reply: '🚚 FREE delivery on orders ₹699+. ₹19 on ₹399–₹699. Order 👉 wa.me/' + WA_NUMBER },
  { match: /\b(fish|machli|rohu|prawn)\b/i,
    reply: '🐟 Fresh fish available — Rohu, Katla, Basa, Prawns. WhatsApp 👉 wa.me/' + WA_NUMBER },
  { match: /\b(plus|membership|subscribe)\b/i,
    reply: '💎 MeatPe Plus ₹99/month — unlimited free delivery + member offers. WhatsApp to join 👉 wa.me/' + WA_NUMBER },
];

const DEFAULT_REPLY = '🙏 Thanks for your interest! Order on WhatsApp 👉 wa.me/' + WA_NUMBER;

function pickReply(text) {
  if (!text) return DEFAULT_REPLY;
  for (const k of KEYWORDS) if (k.match.test(text)) return k.reply;
  return DEFAULT_REPLY;
}

async function replyToComment(commentId, message) {
  if (!TOKEN) throw new Error('IG_ACCESS_TOKEN missing');
  const url = `${GRAPH}/${commentId}/replies`;
  return axios.post(url, null, { params: { message, access_token: TOKEN } });
}

// Express handler — mount at /webhook/instagram
async function handleInstagramWebhook(req, res) {
  // Verification (GET) — Facebook will hit this once
  if (req.method === 'GET') {
    const verifyToken = process.env.IG_VERIFY_TOKEN || 'meatpe_verify';
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === verifyToken) {
      return res.status(200).send(req.query['hub.challenge']);
    }
    return res.sendStatus(403);
  }

  // Comment event (POST)
  try {
    const body = req.body;
    if (body.object === 'instagram') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'comments') {
            const v = change.value;
            const commentId = v.id;
            const text = v.text || '';
            // Avoid replying to our own comments (best effort)
            if (v.from && v.from.id && process.env.IG_USER_ID && v.from.id === process.env.IG_USER_ID) continue;
            const reply = pickReply(text);
            try {
              await replyToComment(commentId, reply);
              console.log(`💬 Replied to ${commentId}: ${reply.slice(0, 60)}`);
            } catch (err) {
              console.error('Reply failed:', err.response?.data || err.message);
            }
          }
        }
      }
    }
    res.sendStatus(200);
  } catch (e) {
    console.error('IG webhook error:', e.message);
    res.sendStatus(500);
  }
}

module.exports = { handleInstagramWebhook, pickReply, replyToComment };
