import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function capture() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // 1. Desktop English (1280x900)
  await page.setViewport({ width: 1280, height: 950 });
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1200)); // Allow live weather & mandi APIs to settle
  await page.screenshot({ path: path.join(__dirname, '../public/agriguide_refined_desktop_1280_live.png') });
  console.log('Saved agriguide_refined_desktop_1280_live.png');

  // 2. Desktop Telugu (1280x900) - click Telugu language button
  const teButtons = await page.$$('button');
  for (const btn of teButtons) {
    const text = await (await btn.getProperty('textContent')).jsonValue();
    if (text && text.trim() === 'తె') {
      await btn.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(__dirname, '../public/agriguide_refined_desktop_1280_te.png') });
  console.log('Saved agriguide_refined_desktop_1280_te.png');

  // 3. Mobile English (390x844)
  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await mobilePage.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1200));
  await mobilePage.screenshot({ path: path.join(__dirname, '../public/agriguide_refined_mobile_390_live.png') });
  console.log('Saved agriguide_refined_mobile_390_live.png');

  // 4. Mobile Telugu (390x844)
  const mobileTeButtons = await mobilePage.$$('button');
  for (const btn of mobileTeButtons) {
    const text = await (await btn.getProperty('textContent')).jsonValue();
    if (text && text.trim() === 'తె') {
      await btn.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 600));
  await mobilePage.screenshot({ path: path.join(__dirname, '../public/agriguide_refined_mobile_390_te.png') });
  console.log('Saved agriguide_refined_mobile_390_te.png');

  await browser.close();
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
