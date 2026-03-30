import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  console.log("Navigating to login...");
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
  
  try {
    console.log("Typing credentials...");
    await page.evaluate(() => {
      document.querySelector('input[type="email"]').value = 'admin@grid.ph';
      document.querySelector('input[type="password"]').value = 'admin123';
      document.querySelector('button[type="submit"]').click();
    });
    
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(e => console.log("Nav wait timeout:", e.message));
  } catch(e) { console.log(e.message); }

  console.log("Going to drivers...");
  await page.goto('http://localhost:5173/drivers', { waitUntil: 'networkidle2' });
  
  console.log("Saving screenshot...");
  await page.screenshot({ path: 'drivers_debug.png' });
  
  const bodyText = await page.evaluate(() => document.body.innerHTML);
  console.log("BODY length:", bodyText.length);
  console.log("Body snippet:", bodyText.substring(0, 3000));
  
  await browser.close();
})();
