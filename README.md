# 🥩 MeatPe — WhatsApp Order Bot + Instagram Auto-Post

**Tagline:** _Fresh Meat in 30 Minutes — Taaza, Tezz, Trusted_

A free-tier ready system for **MeatPe** (Agra, UP) that:

- Takes orders on **WhatsApp** via Twilio (free Sandbox to start)
- Auto-replies to **Instagram comments** with smart keyword routing
- **Auto-posts** to Instagram on a daily schedule
- Tracks customers, cart, orders, and **MeatPe Cash** rewards in SQLite
- Calculates delivery charges + reward eligibility per your rules

---

## 1. Local setup

```bash
# inside project folder
npm install
copy .env.example .env       # Windows  (use 'cp' on mac/linux)
# fill in TWILIO_* and IG_* values in .env
npm run init-db
npm run dev
```

Server starts on `http://localhost:3000`.

---

## 2. WhatsApp setup (Twilio Sandbox — FREE)

1. Sign up at <https://www.twilio.com/try-twilio> (no card for sandbox).
2. Console → **Messaging → Try it out → Send a WhatsApp Message**.
3. Copy the **Sandbox number** (e.g. `+1 415 523 8886`) and the **join code**.
4. From your phone, send `join <code>` on WhatsApp to that number.
5. Expose your local server publicly while testing:
   ```bash
   npx ngrok http 3000
   ```
6. In Twilio Sandbox settings, set:
   - **When a message comes in** → `https://<ngrok-id>.ngrok-free.app/webhook/whatsapp`
   - Method: `POST`
7. Send `hi` to the Sandbox number from your phone — bot replies with menu.

For production (real branded number) you need a Twilio approved WhatsApp Business sender. Sandbox is fine until you get traction.

---

## 3. Instagram setup (Business / Creator account)

You need a **Facebook Page** linked to an **Instagram Business** account.

1. Convert your Instagram to a **Business / Creator** account (Instagram → Settings → Account type).
2. Link it to a Facebook Page (`facebook.com/<page>` → Settings → Linked accounts → Instagram).
3. Go to <https://developers.facebook.com> → Create App → type **Business**.
4. Add product: **Instagram Graph API**.
5. In Graph API Explorer, generate a **long-lived Page Access Token** with these scopes:
   - `instagram_basic`
   - `instagram_content_publish`
   - `instagram_manage_comments`
   - `pages_show_list`, `pages_read_engagement`
6. Get your **IG User ID**:
   ```
   GET https://graph.facebook.com/v20.0/me/accounts?access_token=PAGE_TOKEN
   GET https://graph.facebook.com/v20.0/<PAGE_ID>?fields=instagram_business_account&access_token=PAGE_TOKEN
   ```
7. Put values in `.env`:
   - `IG_USER_ID`
   - `IG_ACCESS_TOKEN`
   - `IG_VERIFY_TOKEN=meatpe_verify` (any string you choose)
8. **Webhook for comments**: App Dashboard → Webhooks → Instagram → subscribe to `comments`. Callback URL: `https://<your-domain>/webhook/instagram`. Verify token: same as `IG_VERIFY_TOKEN`.
9. **Auto-post** runs daily at 11:00 AM IST. Trigger manually:
   ```
   POST https://<your-domain>/admin/ig-post?key=<ADMIN_KEY>
   ```

> Note: Image posts need a **publicly accessible HTTPS image URL**. Use Cloudinary free, ImgBB, or a public GitHub raw URL.

---

## 4. Free deployment — Render

1. Push this folder to a GitHub repo.
2. <https://render.com> → **New → Web Service** → connect repo.
3. It auto-detects `render.yaml`. Click **Apply**.
4. In **Environment** tab, paste:
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`
   - `IG_USER_ID`, `IG_ACCESS_TOKEN`, `IG_VERIFY_TOKEN`
   - `ADMIN_WHATSAPP` (e.g. `whatsapp:+919876543210`)
   - `ADMIN_KEY` (any random string for the manual post endpoint)
5. Once live (`https://meatpe-bot.onrender.com`), update:
   - Twilio Sandbox webhook → `/webhook/whatsapp`
   - Instagram webhook → `/webhook/instagram`

> ⚠️ Render free tier sleeps after 15 min idle. First message after sleep takes ~30 sec. For always-on, upgrade or use Railway / Fly.io.

### Free deployment — Railway (alternative)

```bash
npm i -g @railway/cli
railway login
railway init
railway up
railway variables set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... ...
```

Railway gives you a public domain automatically.

---

## 5. Bot conversation flow

```
Customer  →  hi
Bot       →  Welcome menu (1 Menu / 2 Cart / 3 Order / 4 Rewards / 5 Plus / 6 Human)
Customer  →  1
Bot       →  Categories A–E
Customer  →  A          (chicken)
Bot       →  Lists items with codes (C1, C2, ...)
Customer  →  add C1 2
Bot       →  Added; subtotal shown
Customer  →  order
Bot       →  Asks address (if missing) → shows order summary
Customer  →  confirm
Bot       →  Order placed, ETA 30 min, MeatPe Cash earned
```

All commands: `menu`, `cart`, `order`, `confirm`, `add C1 2`, `remove 1`, `clear`, `address <text>`, `rewards`, `plus`, `human`, `hi`.

---

## 6. Suggestions & gaps in your current plan (advice you asked for)

Pricing & business
1. **Boneless chicken band ₹320–350** is a range — pick a single SKU price for predictability. I used ₹335 default. Use a daily message if rate changes.
2. **Mutton boneless ₹900–950** same — pinned at ₹925.
3. **Ready-to-cook margin** is highest. Push these in IG posts. I added 14 SKUs (kebabs, tikka, nuggets, sausages, salami) — all sourceable in Agra.
4. **Fish in Agra UP** — Rohu, Katla, Singhara, Tilapia easily available locally; Pomfret, Basa, Prawns from frozen suppliers (Licious/Captain Fresh distributors operate in Agra).
5. **Add minimum order value** display on every cart message (you have ₹399 implicit via delivery rule, but state it).

Trust & retention
6. **Halal / Jhatka tag** — display clearly per item. Big trust signal.
7. **Cleaning + cutting "free"** — say it explicitly in welcome message.
8. **First-order discount** — no current incentive. Suggest ₹50 off first order code `WELCOME50` to convert IG followers.
9. **Refer & earn** — ₹50 to each side after referee's first order. Easy to bolt on later.
10. **MeatPe Cash expiry of 15 days is short** — consider 30 days, more usage. Free tier psychologically.

Operations
11. **Slot-based delivery** — instead of "30 minutes", offer slots (e.g. 9–11 AM, 11–1 PM). Helps planning, reduces failed deliveries.
12. **Cash on delivery + UPI link** in confirmation — currently included as `meatpe@upi` placeholder.
13. **Out-of-stock handling** — bot does not yet check stock. Add a `stock` flag in `catalog.js` later.
14. **Admin dashboard** — start with WhatsApp notification (already added). Add a simple `/admin/orders` HTML view next.

Marketing (Instagram)
15. **Reels > Photos** — Graph API can publish Reels too. Add when ready.
16. **Story mentions** — auto-thank tagged stories. Phase 2.
17. **Hashtag strategy** — I added local-flavored tags. Add `#AgraFood #AgraEats #ShahganjAgra #SikandraAgra` to target hyperlocal.
18. **Posting time** — 11 AM IST is set. Better times for food: **11 AM** (lunch buy) and **6 PM** (dinner buy). Consider two daily posts.

---

## 7. File map

```
meatpe/
├── package.json
├── .env.example
├── render.yaml
├── Procfile
├── src/
│   ├── server.js                 # Express + cron
│   ├── data/catalog.js           # Menu (chicken, mutton, fish, RTC, packs)
│   ├── db/init.js                # SQLite schema
│   ├── services/
│   │   ├── pricing.js            # Delivery + reward calc
│   │   └── session.js            # Cart + customer persistence
│   ├── whatsapp/
│   │   ├── bot.js                # Conversation logic
│   │   └── twilio.js             # Twilio client + TwiML
│   └── instagram/
│       ├── post.js               # Auto-post via Graph API
│       └── replies.js            # Comment auto-reply
└── data/
    └── meatpe.db                 # Created on first run
```

---

Made for **MeatPe Agra** 🐔🐐🐟  •  Free-tier deployable.
