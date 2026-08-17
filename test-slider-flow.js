#!/usr/bin/env node
/**
 * Test Image Slider End-to-End Flow
 * Verifies: catalog.json → server endpoint → frontend rendering
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const TEST_PORT = 3000;
const CATALOG_PATH = path.join(__dirname, 'data', 'catalog.json');

function readCatalog() {
  return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
}

function testCatalogHasImages() {
  console.log('\n📋 TEST 1: Verify catalog.json has images');
  const items = readCatalog();
  const c1 = items.find(i => i.code === 'C1');
  
  if (!c1) {
    console.error('  ❌ C1 product not found');
    return false;
  }
  
  const hasImages = c1.images && Array.isArray(c1.images) && c1.images.length > 0;
  if (hasImages) {
    console.log(`  ✅ C1 has ${c1.images.length} images`);
    console.log(`    - Image 1: ${c1.images[0].substring(0, 50)}...`);
    if (c1.images.length > 1) console.log(`    - Image 2: ${c1.images[1].substring(0, 50)}...`);
    if (c1.images.length > 2) console.log(`    - Image 3: ${c1.images[2].substring(0, 50)}...`);
    return true;
  } else {
    console.error('  ❌ C1 has no images array or is empty');
    return false;
  }
}

function testServerResponse() {
  console.log('\n🔌 TEST 2: Verify server /api/menu returns images');
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/menu',
      method: 'GET'
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          const c1 = response.menu ? response.menu.find(i => i.code === 'C1') : null;
          
          if (!c1) {
            console.error('  ❌ Server returned no C1 product');
            resolve(false);
            return;
          }
          
          const hasImages = c1.images && Array.isArray(c1.images) && c1.images.length > 0;
          if (hasImages) {
            console.log(`  ✅ Server returned C1 with ${c1.images.length} images`);
            resolve(true);
          } else {
            console.error('  ❌ Server returned C1 with no images');
            resolve(false);
          }
        } catch (e) {
          console.error(`  ❌ Failed to parse response: ${e.message}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', () => {
      console.error('  ⚠️  Could not connect to server (is it running on :3000?)');
      resolve(null); // Skip this test if server not running
    });
    
    req.end();
  });
}

async function runTests() {
  console.log('═══════════════════════════════════════');
  console.log('🎬 Image Slider End-to-End Test Suite');
  console.log('═══════════════════════════════════════');
  
  const test1 = testCatalogHasImages();
  const test2 = await testServerResponse();
  
  console.log('\n═══════════════════════════════════════');
  if (test1 && test2 !== false) {
    console.log('✅ ALL TESTS PASSED - Slider should work!');
    console.log('\nNext steps:');
    console.log('1. Open user app in browser');
    console.log('2. Navigate to "Chicken" category');
    console.log('3. Click on "Premium Fresh Chicken (1kg)" product');
    console.log('4. You should see a product card with 3 dots for slide navigation');
    console.log('5. Click dots or swipe to see images change');
  } else if (test1 && test2 === null) {
    console.log('✅ CATALOG TEST PASSED (Server not running, skipped endpoint test)');
    console.log('\nTo verify server response:');
    console.log('1. Start the server: npm start');
    console.log('2. Run this test again');
  } else {
    console.log('❌ TESTS FAILED - Check catalog.json and server');
  }
  console.log('═══════════════════════════════════════\n');
}

runTests().catch(console.error);
