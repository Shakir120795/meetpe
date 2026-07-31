// Instagram auto-post (Graph API)
// Requires:
//  - IG Business / Creator account linked to a Facebook Page
//  - Long-lived Page Access Token (env IG_ACCESS_TOKEN)
//  - IG_USER_ID (the IG business account id)
//
// Posting requires a publicly accessible image URL. For free hosting,
// use Cloudinary, ImgBB, or a public GitHub repo raw URL.

require('dotenv').config();
const axios = require('axios');

const IG_USER_ID = process.env.IG_USER_ID;
const TOKEN = process.env.IG_ACCESS_TOKEN;
const GRAPH = 'https://graph.facebook.com/v20.0';

async function postImage({ imageUrl, caption }) {
  if (!IG_USER_ID || !TOKEN) {
    throw new Error('IG_USER_ID or IG_ACCESS_TOKEN missing in .env');
  }
  // Step 1: create container
  const create = await axios.post(`${GRAPH}/${IG_USER_ID}/media`, null, {
    params: { image_url: imageUrl, caption, access_token: TOKEN },
  });
  const creationId = create.data.id;

  // Step 2: publish
  const publish = await axios.post(`${GRAPH}/${IG_USER_ID}/media_publish`, null, {
    params: { creation_id: creationId, access_token: TOKEN },
  });
  return publish.data; // { id }
}

// Sample daily posts you can rotate
const SAMPLE_POSTS = [
  {
    imageUrl: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=1080',
    caption:
`🐔 Fresh Chicken Today!
Premium 1kg @ ₹260 — Taaza, hygienically cleaned.

Order on WhatsApp 👉 wa.me/91XXXXXXXXXX
#MeatPe #FreshMeat #Agra #ChickenLovers #FreshChicken #30MinDelivery`,
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=1080',
    caption:
`🔥 Weekend Party Pack — ₹2199
3kg mixed combo (Chicken + Mutton). Family-size. Cleaned + cut.

WhatsApp order 👉 wa.me/91XXXXXXXXXX
#WeekendVibes #PartyPack #MeatPe #Agra`,
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1626082929543-5bab6f17c5ce?w=1080',
    caption:
`🐟 Fish Lovers Combo — ₹899
Rohu + Basa Fillet + Prawns. Cleaned & ready.

Order: wa.me/91XXXXXXXXXX
#FreshFish #Agra #FishCombo #MeatPe`,
  },
];

async function postRandomSample() {
  const pick = SAMPLE_POSTS[Math.floor(Math.random() * SAMPLE_POSTS.length)];
  return postImage(pick);
}

if (require.main === module) {
  postRandomSample()
    .then(r => console.log('✅ Posted:', r))
    .catch(e => console.error('❌ Post failed:', e.response?.data || e.message));
}

module.exports = { postImage, postRandomSample, SAMPLE_POSTS };
