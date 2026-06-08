const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 340, height: 900 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://127.0.0.1:8777/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const tabs = ['dist', 'colorlab', 'glow'];
  for (const t of tabs) {
    await page.evaluate((tab) => {
      const b = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
      if (b) b.click();
    }, t);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `.preview/panel-${t}.png`, fullPage: true });
  }
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
