// MeatPe WhatsApp bot — handles incoming Twilio messages and replies
const { catalog, categoryLabels, findByCode, byCategory, isInStock } = require('../data/catalog');
const { getSession, saveSession, clearSession, upsertCustomer, getCustomer } = require('../services/session');
const { calcDelivery, rewardEarned, summarizeCart, FREE_ABOVE, LOW_BELOW } = require('../services/pricing');
const db = require('../db/init');

const SHOP = process.env.SHOP_NAME || 'MeatPe';
const TAGLINE = process.env.TAGLINE || 'Fresh Meat in 30 Minutes — Taaza, Tezz, Trusted';

// ===== Reply builders =====
function welcomeMsg(name) {
  const hello = name ? `Hi ${name}!` : 'Hi!';
  return (
`${hello} Welcome to *${SHOP}* 🥩
_${TAGLINE}_

Reply with a number to continue:
1️⃣  View Menu
2️⃣  View Cart
3️⃣  Place Order
4️⃣  My Rewards
5️⃣  MeatPe Plus (₹99/month)
6️⃣  Talk to Human

Tip: Type *menu* anytime to see categories.`
  );
}

function menuCategoriesMsg() {
  return (
`📋 *Menu Categories*

A. 🐔 Fresh Chicken
B. 🐐 Fresh Mutton
C. 🐟 Fresh Fish
D. 🔥 Ready to Cook
E. 👨‍👩‍👧 Family / Combo Packs

Reply with letter (A–E) to see items.
Or type *all* to see everything.`
  );
}

function listCategory(catKey) {
  const items = byCategory(catKey);
  if (!items.length) return 'No items in this category.';
  const header = `*${categoryLabels[catKey]}*\n`;
  const lines = items.map(i => {
    const oos = isInStock(i.code) ? '' : ' ❌ _(out of stock)_';
    return `\`${i.code}\` ${i.name} — ₹${i.price}${oos}`;
  });
  return header + '\n' + lines.join('\n') + '\n\n👉 To add: type *add <CODE> <qty>*\nExample: _add C1 2_';
}

function listAll() {
  const groups = Object.keys(categoryLabels).map(k => listCategory(k)).join('\n\n');
  return groups + '\n\nType *cart* to view cart, *order* to checkout.';
}

function cartMsg(session) {
  if (!session.cart.length) return 'Your cart is empty 🛒\nType *menu* to start shopping.';
  const lines = session.cart.map((c, idx) =>
    `${idx + 1}. ${c.name} × ${c.qty} = ₹${c.price * c.qty}`
  );
  const { subtotal } = summarizeCart(session.cart);
  return (
`🛒 *Your Cart*

${lines.join('\n')}

Subtotal: ₹${subtotal}

Commands: *order* | *clear* | *remove <#>* | *menu*`
  );
}

function checkoutPreviewMsg(session, customer) {
  const { subtotal } = summarizeCart(session.cart);
  const isPlus = customer && customer.is_plus === 1;
  const delivery = calcDelivery(subtotal, isPlus);
  const total = subtotal + delivery;
  const reward = rewardEarned(subtotal);

  let deliveryLine;
  if (isPlus) deliveryLine = '🚚 Delivery: FREE (Plus member)';
  else if (delivery === 0) deliveryLine = '🚚 Delivery: FREE 🎉';
  else deliveryLine = `🚚 Delivery: ₹${delivery}`;

  const rewardLine = reward > 0
    ? `🎁 You will earn ₹${reward} MeatPe Cash (valid 15 days)`
    : `🎁 Add ₹${500 - subtotal > 0 ? (500 - subtotal) : 0} more to earn ₹30 MeatPe Cash`;

  const addr = customer && customer.address ? customer.address : '_(not set)_';
  return (
`🧾 *Order Summary*

Subtotal: ₹${subtotal}
${deliveryLine}
*Total: ₹${total}*

${rewardLine}

📍 Delivery Address:
${addr}

Reply *confirm* to place order, or *address <new address>* to change address.`
  );
}

function rewardsMsg(phone) {
  const rows = db.prepare(
    `SELECT amount, expires_at, used FROM rewards
     WHERE phone = ? AND used = 0 AND expires_at > datetime('now')
     ORDER BY expires_at ASC`
  ).all(phone);
  if (!rows.length) return 'You have no active MeatPe Cash 🎁\nOrder ₹500+ to earn ₹30 cashback.';
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const lines = rows.map(r => `• ₹${r.amount} — expires ${r.expires_at.split(' ')[0]}`);
  return `🎁 *Your MeatPe Cash*\n\n${lines.join('\n')}\n\n*Total: ₹${total}*`;
}

function plusMsg() {
  return (
`💎 *MeatPe Plus — ₹99/month*

✅ Unlimited FREE delivery
✅ Priority order slots
✅ Member-only offers
✅ Special weekend deals

Reply *plus join* to subscribe (we will share UPI link).`
  );
}

// ===== Command parser =====
function parseAdd(text) {
  // "add C1 2" or "add C1"
  const m = text.match(/^add\s+([a-z]\d+)\s*(\d+)?$/i);
  if (!m) return null;
  return { code: m[1].toUpperCase(), qty: Number(m[2] || 1) };
}

function parseRemove(text) {
  const m = text.match(/^remove\s+(\d+)$/i);
  return m ? Number(m[1]) - 1 : null;
}

function parseAddress(text) {
  const m = text.match(/^address\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

// ===== Order placement =====
function placeOrder(phone, session, customer) {
  const { subtotal } = summarizeCart(session.cart);
  const isPlus = customer && customer.is_plus === 1;
  const delivery = calcDelivery(subtotal, isPlus);
  const total = subtotal + delivery;

  const stmt = db.prepare(`
    INSERT INTO orders (phone, items_json, subtotal, delivery_fee, total, address, source)
    VALUES (?, ?, ?, ?, ?, ?, 'whatsapp')
  `);
  const info = stmt.run(
    phone,
    JSON.stringify(session.cart),
    subtotal,
    delivery,
    total,
    customer && customer.address ? customer.address : ''
  );

  // Reward
  const reward = rewardEarned(subtotal);
  if (reward > 0) {
    db.prepare(`
      INSERT INTO rewards (phone, amount, expires_at)
      VALUES (?, ?, datetime('now', '+15 days'))
    `).run(phone, reward);
  }

  return { orderId: info.lastInsertRowid, subtotal, delivery, total, reward };
}

// ===== Main handler =====
function handleMessage({ from, body }) {
  const phone = from; // already includes "whatsapp:+91..."
  const text = (body || '').trim();
  const lower = text.toLowerCase();
  const session = getSession(phone);
  const customer = getCustomer(phone);

  // Greetings / start
  if (['hi', 'hii', 'hello', 'hey', 'start', 'menu start', 'namaste'].includes(lower)) {
    saveSession(phone, 'home', session.cart);
    return welcomeMsg(customer && customer.name);
  }

  // Top-level numeric menu
  if (lower === '1' || lower === 'menu')   return menuCategoriesMsg();
  if (lower === '2' || lower === 'cart')   return cartMsg(session);
  if (lower === '3' || lower === 'order' || lower === 'checkout') {
    if (!session.cart.length) return 'Cart is empty. Type *menu* to add items.';
    if (!customer || !customer.address) {
      saveSession(phone, 'awaiting_address', session.cart);
      return 'Please share your *delivery address* (full address with landmark + pincode).';
    }
    return checkoutPreviewMsg(session, customer);
  }
  if (lower === '4' || lower === 'rewards') return rewardsMsg(phone);
  if (lower === '5' || lower === 'plus')    return plusMsg();
  if (lower === '6' || lower === 'human')   return '👤 A team member will reach out shortly. For urgent: call *+91-XXXXXXXXXX*.';

  // Category select
  if (/^[a-e]$/i.test(lower)) {
    const map = { a: 'chicken', b: 'mutton', c: 'fish', d: 'ready_to_cook', e: 'family_pack' };
    return listCategory(map[lower]);
  }
  if (lower === 'all') return listAll();

  // Add to cart
  const add = parseAdd(lower);
  if (add) {
    const item = findByCode(add.code);
    if (!item) return `Code *${add.code}* not found. Type *menu* to see codes.`;

    if (!isInStock(item.code)) {
      // Suggest in-stock alternatives from the same category
      const alts = byCategory(item.cat).filter(i => i.code !== item.code && isInStock(i.code)).slice(0, 4);
      const altLines = alts.length
        ? '\n\n👉 Try these instead:\n' + alts.map(a => `\`${a.code}\` ${a.name} — ₹${a.price}`).join('\n')
        : '';
      return `😔 Sorry, *${item.name}* is currently out of stock.${altLines}\n\nType *menu* to see all categories.`;
    }

    const existing = session.cart.find(c => c.code === item.code);
    if (existing) existing.qty += add.qty;
    else session.cart.push({ code: item.code, name: item.name, price: item.price, unit: item.unit, qty: add.qty });
    saveSession(phone, session.state || 'shopping', session.cart);
    const { subtotal } = summarizeCart(session.cart);
    return `✅ Added: ${item.name} × ${add.qty}\nSubtotal: ₹${subtotal}\n\nType *cart* to view, *order* to checkout, or *menu* for more.`;
  }

  // Remove
  const rmIdx = parseRemove(lower);
  if (rmIdx !== null) {
    if (rmIdx < 0 || rmIdx >= session.cart.length) return 'Invalid item number.';
    const removed = session.cart.splice(rmIdx, 1)[0];
    saveSession(phone, session.state, session.cart);
    return `🗑️ Removed: ${removed.name}\n\n${cartMsg(session)}`;
  }

  if (lower === 'clear') {
    saveSession(phone, 'home', []);
    return 'Cart cleared 🧹\nType *menu* to start fresh.';
  }

  // Address change/set
  const newAddr = parseAddress(text);
  if (newAddr) {
    upsertCustomer(phone, { address: newAddr });
    if (session.state === 'awaiting_address' && session.cart.length) {
      const c = getCustomer(phone);
      saveSession(phone, 'awaiting_confirm', session.cart);
      return `📍 Address saved.\n\n${checkoutPreviewMsg(session, c)}`;
    }
    return '📍 Address saved.';
  }

  // If we are awaiting address and user just sent free text, treat as address
  if (session.state === 'awaiting_address' && text.length > 8) {
    upsertCustomer(phone, { address: text });
    const c = getCustomer(phone);
    saveSession(phone, 'awaiting_confirm', session.cart);
    return `📍 Address saved.\n\n${checkoutPreviewMsg(session, c)}`;
  }

  // Confirm
  if (lower === 'confirm' || lower === 'yes') {
    if (!session.cart.length) return 'Cart is empty.';
    const c = getCustomer(phone);
    if (!c || !c.address) {
      saveSession(phone, 'awaiting_address', session.cart);
      return 'Please share your *delivery address* first.';
    }
    const result = placeOrder(phone, session, c);
    clearSession(phone);
    const rewardLine = result.reward > 0 ? `\n🎁 You earned ₹${result.reward} MeatPe Cash!` : '';
    return (
`✅ *Order Placed!*
Order #${result.orderId}

Subtotal: ₹${result.subtotal}
Delivery: ₹${result.delivery}
*Total: ₹${result.total}*

📍 ${c.address}

ETA: ~30 minutes 🛵${rewardLine}

Pay on delivery or UPI: *meatpe@upi*
Thank you! Type *hi* anytime to order again.`
    );
  }

  if (lower === 'plus join') {
    return 'Pay ₹99 to UPI: *meatpe@upi* and reply with screenshot. We will activate Plus instantly.';
  }

  // Fallback
  return (
`I didn't get that 🤔
Try:
• *menu* — see categories
• *cart* — view cart
• *order* — checkout
• *hi* — main menu`
  );
}

module.exports = { handleMessage };
