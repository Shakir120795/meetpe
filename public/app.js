// ===== MeatPe website — frontend logic =====

// MeatPe official WhatsApp Business number (asli number)
const WA_NUMBER = '917617555488';

const CATEGORY_ICONS = {
  chicken: '🐔', mutton: '🐐', fish: '🐟',
  ready_to_cook: '🔥', family_pack: '👨‍👩‍👧',
};

const DELIVERY = { freeAbove: 699, lowBelow: 399, feeLow: 29, feeMid: 19 };
const REWARD = { threshold: 500, amount: 30 };

let MENU = [];
let CART = loadCart();
let APPLIED_COUPON = null; // { code, discount }
let AVAILABLE_COUPONS = [];

// ===== Storage helpers =====
function loadCart() {
  try { return JSON.parse(localStorage.getItem('meatpe_cart') || '[]'); }
  catch { return []; }
}
function saveCart() {
  localStorage.setItem('meatpe_cart', JSON.stringify(CART));
  updateCartBadge();
}

// ===== Fetch menu =====
async function loadMenu() {
  try {
    const res = await fetch('/api/menu');
    if (!res.ok) throw new Error();
    MENU = await res.json();
    renderCategory('chicken');
  } catch {
    document.getElementById('menuGrid').innerHTML =
      '<p style="text-align:center;color:#888;grid-column:1/-1">Menu loading failed. Please refresh.</p>';
  }
}

// ===== Render menu items =====
function renderCategory(cat) {
  const grid = document.getElementById('menuGrid');
  const items = MENU.filter(i => i.cat === cat);
  if (!items.length) { grid.innerHTML = '<p>No items.</p>'; return; }
  const fallback = CATEGORY_ICONS[cat] || '🍽️';
  grid.innerHTML = items.map(i => {
    const inStock = i.inStock !== false;
    const images = Array.isArray(i.images) && i.images.length ? i.images : (i.img && i.img.trim() ? [i.img.trim()] : []);
    const hasImages = images.length > 0;

    let imgHtml;
    if (hasImages && images.length === 1) {
      imgHtml = `<img class="card-img" src="${escapeHtml(images[0])}" alt="${escapeHtml(i.name)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-img card-img-fallback cat-${cat}\\'><span class=\\'cat-icon\\'>${fallback}</span><span class=\\'cat-tag\\'>${escapeHtml(i.unit)}</span></div>'" />`;
    } else if (hasImages && images.length > 1) {
      const slides = images.map((url, idx) =>
        `<div class="slide ${idx === 0 ? 'active' : ''}" data-idx="${idx}"><img src="${escapeHtml(url)}" alt="${escapeHtml(i.name)} ${idx+1}" loading="lazy" /></div>`
      ).join('');
      const dots = images.map((_, idx) =>
        `<span class="dot ${idx === 0 ? 'active' : ''}" data-idx="${idx}"></span>`
      ).join('');
      imgHtml = `<div class="card-slider" data-total="${images.length}">${slides}<div class="slider-dots">${dots}</div><button class="slider-btn prev" aria-label="Previous">‹</button><button class="slider-btn next" aria-label="Next">›</button></div>`;
    } else {
      imgHtml = `<div class="card-img card-img-fallback cat-${cat}"><span class="cat-icon">${fallback}</span><span class="cat-tag">${escapeHtml(i.unit)}</span></div>`;
    }

    const oosOverlay = inStock ? '' : '<div class="oos-badge">Sold Out</div>';
    const desc = i.description ? `<div class="card-desc">${escapeHtml(i.description)}</div>` : '';
    const action = inStock
      ? `<div class="card-action" data-code="${i.code}"></div>`
      : `<span class="card-add card-add-disabled">Out of Stock</span>`;
    return `
    <div class="menu-card ${inStock ? '' : 'menu-card-oos'}">
      <div class="card-img-wrap">${imgHtml}${oosOverlay}</div>
      <div class="card-body">
        <div class="card-name">${escapeHtml(i.name)}</div>
        <div class="card-unit">${escapeHtml(i.unit)}</div>
        ${desc}
        <div class="card-bottom">
          <div class="card-price">₹${i.price}</div>
          ${action}
        </div>
      </div>
    </div>`;
  }).join('');

  initSliders();
  refreshCardActions();
}

// ===== Image Slider logic =====
function initSliders() {
  document.querySelectorAll('.card-slider').forEach(slider => {
    if (slider.dataset.init) return;
    slider.dataset.init = '1';
    const total = parseInt(slider.dataset.total, 10);
    let current = 0;
    
    function goTo(idx) {
      if (idx < 0) idx = total - 1;
      if (idx >= total) idx = 0;
      current = idx;
      slider.querySelectorAll('.slide').forEach(s => s.classList.toggle('active', parseInt(s.dataset.idx) === idx));
      slider.querySelectorAll('.dot').forEach(d => d.classList.toggle('active', parseInt(d.dataset.idx) === idx));
    }
    
    // Button navigation
    slider.querySelector('.next').addEventListener('click', (e) => { e.stopPropagation(); goTo(current + 1); });
    slider.querySelector('.prev').addEventListener('click', (e) => { e.stopPropagation(); goTo(current - 1); });
    
    // Dot navigation
    slider.querySelectorAll('.dot').forEach(d => {
      d.addEventListener('click', (e) => { e.stopPropagation(); goTo(parseInt(d.dataset.idx)); });
    });
    
    // Auto-play (pause on hover)
    let autoTimer = setInterval(() => goTo(current + 1), 3500);
    slider.addEventListener('mouseenter', () => clearInterval(autoTimer));
    slider.addEventListener('mouseleave', () => { autoTimer = setInterval(() => goTo(current + 1), 3500); });
    
    // ===== SWIPE GESTURE SUPPORT =====
    let touchStartX = 0;
    let touchEndX = 0;
    let touchStartY = 0;
    let touchEndY = 0;
    const minSwipeDistance = 50; // Minimum swipe distance in pixels
    
    slider.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
      clearInterval(autoTimer); // Pause auto-play during touch
    }, { passive: true });
    
    slider.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      handleSwipe();
      // Resume auto-play after swipe
      autoTimer = setInterval(() => goTo(current + 1), 3500);
    }, { passive: true });
    
    function handleSwipe() {
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;
      
      // Only trigger if horizontal swipe is dominant (not vertical scroll)
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > minSwipeDistance) {
        if (diffX > 0) {
          // Swipe right - go to previous slide
          goTo(current - 1);
        } else {
          // Swipe left - go to next slide
          goTo(current + 1);
        }
      }
    }
  });
}

// Re-renders +/- steppers based on current cart state, called after any cart change
function refreshCardActions() {
  document.querySelectorAll('.card-action').forEach(el => {
    const code = el.dataset.code;
    const item = CART.find(c => c.code === code);
    if (!item) {
      el.innerHTML = `<button class="card-add" data-action="add" data-code="${code}">+ Add</button>`;
    } else {
      el.innerHTML = `
        <div class="card-stepper">
          <button data-action="dec" data-code="${code}" aria-label="Decrease">−</button>
          <span>${item.qty}</span>
          <button data-action="inc" data-code="${code}" aria-label="Increase">+</button>
        </div>`;
    }
  });
  // Bind freshly rendered buttons
  document.querySelectorAll('.card-action [data-action]').forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const code = btn.dataset.code;
      if (btn.dataset.action === 'add' || btn.dataset.action === 'inc') addToCart(code);
      else if (btn.dataset.action === 'dec') changeQty(code, -1);
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ===== Cart logic =====
function addToCart(code) {
  const item = MENU.find(i => i.code === code);
  if (!item || item.inStock === false) return;
  const existing = CART.find(c => c.code === code);
  if (existing) existing.qty += 1;
  else CART.push({ code: item.code, name: item.name, price: item.price, unit: item.unit, img: item.img, qty: 1 });
  saveCart();
  refreshCardActions();
  toast(`Added: ${item.name}`, 'success');
}
function changeQty(code, delta) {
  const item = CART.find(c => c.code === code);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) CART = CART.filter(c => c.code !== code);
  saveCart();
  refreshCardActions();
  renderCart();
}
function removeFromCart(code) {
  CART = CART.filter(c => c.code !== code);
  saveCart();
  refreshCardActions();
  renderCart();
}
function cartCount() { return CART.reduce((s, c) => s + c.qty, 0); }
function cartSubtotal() { return CART.reduce((s, c) => s + c.price * c.qty, 0); }
function calcDelivery(sub) {
  if (sub >= DELIVERY.freeAbove) return 0;
  if (sub < DELIVERY.lowBelow) return DELIVERY.feeLow;
  return DELIVERY.feeMid;
}
function rewardEarned(sub) { return sub >= REWARD.threshold ? REWARD.amount : 0; }

function updateCartBadge() {
  const n = cartCount();
  const show = n > 0;
  ['cartBadge', 'headerCartBadge'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = n;
    el.style.display = show ? 'flex' : 'none';
  });
}

// ===== Drawer rendering =====
function renderCart() {
  const body = document.getElementById('drawerBody');
  const foot = document.getElementById('drawerFoot');
  if (!CART.length) {
    body.innerHTML = `<div class="cart-empty"><div class="big">🛒</div><p>Your cart is empty</p><p style="font-size:13px;margin-top:6px">Browse menu and add some fresh meat!</p></div>`;
    foot.innerHTML = '';
    return;
  }
  body.innerHTML = CART.map(c => {
    const imgEl = c.img
      ? `<img class="cart-item-img" src="${escapeHtml(c.img)}" alt="" />`
      : `<div class="cart-item-img" style="display:flex;align-items:center;justify-content:center;font-size:28px">🍽️</div>`;
    return `
    <div class="cart-item">
      ${imgEl}
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(c.name)}</div>
        <div class="cart-item-price">₹${c.price} × ${c.qty} = ₹${c.price * c.qty}</div>
      </div>
      <div class="cart-qty">
        <button data-act="dec" data-code="${c.code}" aria-label="Decrease">−</button>
        <span>${c.qty}</span>
        <button data-act="inc" data-code="${c.code}" aria-label="Increase">+</button>
      </div>
    </div>`;
  }).join('');

  body.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.code;
      changeQty(code, btn.dataset.act === 'inc' ? 1 : -1);
    });
  });

  const sub = cartSubtotal();
  const del = calcDelivery(sub);
  const total = sub + del;
  const reward = rewardEarned(sub);
  foot.innerHTML = `
    <div class="cart-totals">
      <div class="row"><span>Subtotal</span><strong>₹${sub}</strong></div>
      <div class="row"><span>Delivery</span><strong>${del === 0 ? 'FREE 🎉' : '₹' + del}</strong></div>
      ${reward > 0 ? `<div class="cart-reward">🎁 You'll earn ₹${reward} MeatPe Cash</div>` : ''}
      <div class="row total"><span>Total</span><strong>₹${total}</strong></div>
    </div>
    <div class="drawer-actions">
      <button class="btn btn-primary btn-lg" id="checkoutBtn">Checkout 🚚</button>
      <button class="btn btn-ghost" id="waCheckoutBtn">💬 Order via WhatsApp</button>
    </div>`;
  document.getElementById('checkoutBtn').addEventListener('click', openModal);
  document.getElementById('waCheckoutBtn').addEventListener('click', sendCartToWhatsApp);
}

function openDrawer() {
  renderCart();
  document.getElementById('drawerOverlay').classList.add('open');
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartDrawer').setAttribute('aria-hidden', 'false');
}
function closeDrawer() {
  document.getElementById('drawerOverlay').classList.remove('open');
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartDrawer').setAttribute('aria-hidden', 'true');
}

// ===== Modal (checkout form) =====
function openModal() {
  if (!CART.length) { toast('Cart is empty', 'error'); return; }
  closeDrawer();
  // Reset coupon UI
  APPLIED_COUPON = null;
  const ci = document.getElementById('couponInput');
  const cm = document.getElementById('couponMsg');
  if (ci) ci.value = '';
  if (cm) { cm.className = 'coupon-msg'; cm.textContent = ''; }
  loadAvailableCoupons();
  renderModalSummary();
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}
function renderModalSummary() {
  const sub = cartSubtotal();
  const del = calcDelivery(sub);
  const discount = (APPLIED_COUPON && sub >= 0) ? APPLIED_COUPON.discount : 0;
  const total = Math.max(0, sub - discount + del);
  const lines = CART.map(c => `<div class="row"><span>${escapeHtml(c.name)} × ${c.qty}</span><span>₹${c.price * c.qty}</span></div>`).join('');
  const couponLine = APPLIED_COUPON
    ? `<div class="row" style="color:#16a34a"><span>Coupon (${APPLIED_COUPON.code})</span><span>−₹${discount}</span></div>`
    : '';
  document.getElementById('modalSummary').innerHTML = `
    ${lines}
    ${couponLine}
    <div class="row"><span>Delivery</span><span>${del === 0 ? 'FREE' : '₹' + del}</span></div>
    <div class="row total"><span>Total</span><span>₹${total}</span></div>`;
}

// ===== Coupon =====
async function applyCouponCode(code) {
  const couponMsg = document.getElementById('couponMsg');
  if (!code) {
    APPLIED_COUPON = null;
    couponMsg.className = 'coupon-msg';
    couponMsg.textContent = '';
    renderModalSummary();
    return;
  }
  const sub = cartSubtotal();
  try {
    const res = await fetch('/api/coupon/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal: sub }),
    });
    const data = await res.json();
    if (data.ok) {
      APPLIED_COUPON = { code: data.coupon.code, discount: data.discount };
      couponMsg.className = 'coupon-msg ok';
      couponMsg.textContent = `✅ ${data.coupon.code} applied — you saved ₹${data.discount}`;
    } else {
      APPLIED_COUPON = null;
      couponMsg.className = 'coupon-msg err';
      couponMsg.textContent = `❌ ${data.error || 'Invalid coupon'}`;
    }
  } catch {
    APPLIED_COUPON = null;
    couponMsg.className = 'coupon-msg err';
    couponMsg.textContent = '❌ Could not validate coupon';
  }
  renderModalSummary();
}

async function loadAvailableCoupons() {
  const list = document.getElementById('couponList');
  if (!list) return;
  try {
    const res = await fetch('/api/coupons');
    AVAILABLE_COUPONS = await res.json();
    if (!AVAILABLE_COUPONS.length) {
      list.innerHTML = '<p style="color:var(--gray);font-size:13px;margin:0">No active offers right now.</p>';
      return;
    }
    list.innerHTML = AVAILABLE_COUPONS.map(c => `
      <div class="coupon-card">
        <div class="info">
          <div class="code">${escapeHtml(c.code)}</div>
          <div class="desc">${escapeHtml(c.description || (c.type === 'percent' ? c.value + '% off' : '₹' + c.value + ' off'))}</div>
        </div>
        <button data-coupon="${escapeHtml(c.code)}">Use</button>
      </div>
    `).join('');
    list.querySelectorAll('button[data-coupon]').forEach(b => {
      b.addEventListener('click', () => {
        document.getElementById('couponInput').value = b.dataset.coupon;
        applyCouponCode(b.dataset.coupon);
      });
    });
  } catch {
    list.innerHTML = '<p style="color:#dc2626;font-size:13px;margin:0">Could not load offers.</p>';
  }
}

function buildCartWaMessage(form) {
  const lines = CART.map(c => `${c.name} × ${c.qty} = ₹${c.price * c.qty}`).join('\n');
  const sub = cartSubtotal();
  const del = calcDelivery(sub);
  const discount = APPLIED_COUPON ? APPLIED_COUPON.discount : 0;
  const total = Math.max(0, sub - discount + del);
  let msg = `*New Order - MeatPe* 🥩\n\n${lines}\n\nSubtotal: ₹${sub}`;
  if (APPLIED_COUPON) msg += `\nCoupon (${APPLIED_COUPON.code}): −₹${discount}`;
  msg += `\nDelivery: ₹${del}\n*Total: ₹${total}*`;
  if (form) {
    const fd = new FormData(form);
    const payment = fd.get('payment');
    const paymentLabel = payment === 'pay_online' ? 'Pay Online (UPI)' : 'Pay on Delivery (Cash / UPI)';
    msg += `\n\n👤 ${fd.get('name') || ''}\n📞 ${fd.get('phone') || ''}\n📍 ${fd.get('address') || ''}\n💳 ${paymentLabel}`;
    const notes = fd.get('notes');
    if (notes) msg += `\n📝 ${notes}`;
  }
  return msg;
}

function sendCartToWhatsApp(form) {
  const msg = buildCartWaMessage(form && form.target ? form.target : null);
  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

// ===== Order submit =====
async function submitOrder(form) {
  const fd = new FormData(form);
  const phone = String(fd.get('phone') || '').replace(/\D/g, '');
  if (!fd.get('name') || phone.length !== 10 || !fd.get('address')) {
    toast('Please fill all required fields', 'error');
    return;
  }
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true; submitBtn.innerHTML = '<span>Placing...</span>';

  const payload = {
    name: fd.get('name'),
    phone,
    address: fd.get('address'),
    payment: fd.get('payment') || 'cod',
    notes: fd.get('notes') || '',
    couponCode: APPLIED_COUPON ? APPLIED_COUPON.code : null,
    items: CART.map(c => ({ code: c.code, name: c.name, price: c.price, qty: c.qty })),
  };
  try {
    const res = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'order failed');
    CART = []; saveCart();
    refreshCardActions();
    closeModal();
    APPLIED_COUPON = null;

    // If pay-online chosen, give them a UPI deeplink
    if (payload.payment === 'pay_online') {
      const upiId = 'meatpe@upi';
      const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=MeatPe&am=${data.total}&cu=INR&tn=${encodeURIComponent('Order #' + data.orderId)}`;
      const msg = `✅ Order #${data.orderId} placed!\nTotal: ₹${data.total}\nPay now on UPI: ${upiId}`;
      toast(msg, 'success');
      // Open UPI app on mobile
      setTimeout(() => { window.location.href = upiLink; }, 600);
    } else {
      toast(`✅ Order #${data.orderId} placed! ETA 30 min.`, 'success');
    }
  } catch (e) {
    toast('Could not place order. Try WhatsApp instead.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Place Order</span>';
  }
}

// ===== Toast =====
let toastTimer;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ===== Tabs =====
document.querySelectorAll('.cat-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderCategory(btn.dataset.cat);
  });
});

// ===== WhatsApp deep-link (.wa-btn) =====
function buildWaUrl(msg) {
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg || 'hi')}`;
}
function bindWaButtons() {
  document.querySelectorAll('.wa-btn').forEach(el => {
    if (el.dataset.bound) return;
    el.dataset.bound = '1';
    el.addEventListener('click', (e) => {
      e.preventDefault();
      window.open(buildWaUrl(el.dataset.msg || 'hi'), '_blank');
    });
  });
}

// ===== Bind UI =====
document.getElementById('cartBtn').addEventListener('click', openDrawer);
document.getElementById('headerCart').addEventListener('click', openDrawer);
document.getElementById('drawerClose').addEventListener('click', closeDrawer);
document.getElementById('drawerOverlay').addEventListener('click', closeDrawer);
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});
document.getElementById('checkoutForm').addEventListener('submit', (e) => {
  e.preventDefault();
  submitOrder(e.target);
});
document.getElementById('modalWa').addEventListener('click', () => {
  const form = document.getElementById('checkoutForm');
  const msg = buildCartWaMessage(form);
  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
});

// Coupon apply button
const applyCouponBtn = document.getElementById('applyCouponBtn');
if (applyCouponBtn) {
  applyCouponBtn.addEventListener('click', () => {
    const code = (document.getElementById('couponInput').value || '').trim().toUpperCase();
    document.getElementById('couponInput').value = code;
    applyCouponCode(code);
  });
}
const couponInput = document.getElementById('couponInput');
if (couponInput) {
  couponInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyCouponBtn && applyCouponBtn.click();
    }
  });
}

// ===== Init =====
document.getElementById('yr').textContent = new Date().getFullYear();
loadMenu();
bindWaButtons();
updateCartBadge();

// ===== Support Widget =====
(function initSupport() {
  const fab = document.getElementById('supportFab');
  const panel = document.getElementById('supportPanel');
  const closeBtn = document.getElementById('supportClose');
  if (!fab || !panel) return;

  function open() {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    // Hide the floating dot once user interacts
    const dot = fab.querySelector('.support-dot');
    if (dot) dot.style.display = 'none';
  }
  function close() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }
  fab.addEventListener('click', () => {
    panel.classList.contains('open') ? close() : open();
  });
  closeBtn && closeBtn.addEventListener('click', close);
  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!panel.classList.contains('open')) return;
    if (!panel.contains(e.target) && !fab.contains(e.target)) close();
  });

  // Quick-action buttons → open WhatsApp with prefilled message
  document.querySelectorAll('.quick-btn.wa-help').forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = btn.dataset.msg || 'Hi MeatPe, I need help';
      const url = `https://wa.me/917617555488?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
      close();
    });
  });
})();
