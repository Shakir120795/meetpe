require('dotenv').config();

const FREE_ABOVE = Number(process.env.DELIVERY_FREE_ABOVE || 699);
const LOW_BELOW  = Number(process.env.DELIVERY_LOW_BELOW || 399);
const FEE_LOW    = Number(process.env.DELIVERY_FEE_LOW || 29);
const FEE_MID    = Number(process.env.DELIVERY_FEE_MID || 19);
const REWARD_THRESHOLD = Number(process.env.REWARD_THRESHOLD || 500);
const REWARD_AMOUNT    = Number(process.env.REWARD_AMOUNT || 30);

function calcDelivery(subtotal, isPlusMember = false) {
  if (isPlusMember) return 0;
  if (subtotal >= FREE_ABOVE) return 0;
  if (subtotal < LOW_BELOW) return FEE_LOW;
  return FEE_MID;
}

function rewardEarned(subtotal) {
  return subtotal >= REWARD_THRESHOLD ? REWARD_AMOUNT : 0;
}

function summarizeCart(cart) {
  // cart: [{ code, name, price, qty, unit }]
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  return { subtotal };
}

module.exports = {
  calcDelivery,
  rewardEarned,
  summarizeCart,
  REWARD_THRESHOLD,
  REWARD_AMOUNT,
  FREE_ABOVE,
  LOW_BELOW,
};
