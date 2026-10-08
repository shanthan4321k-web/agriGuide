import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runValidation() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const consoleErrors = [];
  const overflowResults = [];

  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(err.toString());
  });

  const viewports = [
    { name: '320px Mobile Narrow', width: 320, height: 640, isMobile: true },
    { name: '360px Mobile Standard', width: 360, height: 740, isMobile: true },
    { name: '390px Mobile iPhone 14', width: 390, height: 844, isMobile: true },
    { name: '412px Mobile Android Large', width: 412, height: 915, isMobile: true },
    { name: '768px Tablet Portrait', width: 768, height: 1024, isMobile: false },
    { name: '1024px Desktop Standard', width: 1024, height: 768, isMobile: false },
    { name: '1280px Desktop Wide', width: 1280, height: 900, isMobile: false },
    { name: '1440px Large Desktop', width: 1440, height: 900, isMobile: false }
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.isMobile });
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    // Check for horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth;
    });

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);

    overflowResults.push({
      viewport: vp.name,
      width: vp.width,
      scrollWidth,
      hasOverflow: hasHorizontalOverflow
    });

    // Capture required screenshots
    if (vp.width === 320) {
      await page.screenshot({ path: path.join(__dirname, '../public/agriguide_320_en.png') });
    }
    if (vp.width === 390) {
      await page.screenshot({ path: path.join(__dirname, '../public/agriguide_390_en.png') });
    }
    if (vp.width === 1280) {
      await page.screenshot({ path: path.join(__dirname, '../public/agriguide_1280_en.png') });
    }
  }

  // Also test Telugu language at 320px, 390px, 1280px
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  const teButtons = await page.$$('button');
  for (const btn of teButtons) {
    const text = await (await btn.getProperty('textContent')).jsonValue();
    if (text && text.trim() === 'తె') {
      await btn.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(__dirname, '../public/agriguide_1280_te.png') });

  // Telugu at 390px
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(__dirname, '../public/agriguide_390_te.png') });

  // Telugu at 320px
  await page.setViewport({ width: 320, height: 640, isMobile: true });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(__dirname, '../public/agriguide_320_te.png') });

  await browser.close();

  console.log('=== VALIDATION REPORT ===');
  console.log('Console Errors:', consoleErrors.length === 0 ? '0 ERRORS (CLEAN)' : consoleErrors);
  console.log('Overflow Results:');
  console.table(overflowResults);
}

runValidation().catch(err => {
  console.error(err);
  process.exit(1);
});
