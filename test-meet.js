import puppeteer from 'puppeteer';

async function run() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto('https://meet.google.com/new', { waitUntil: 'networkidle2' });
  
  // Wait a bit
  await new Promise(r => setTimeout(r, 5000));
  
  // Find caption buttons
  const captionBtnSelectors = [
      '[aria-label*="captions" i]',
      '[aria-label*="subtitle" i]',
      '[data-tooltip*="captions" i]',
      'button[jsname="r8qRAd"]',
  ];
  
  let found = [];
  for (const s of captionBtnSelectors) {
     const elements = await page.$$(s);
     found.push({ selector: s, count: elements.length });
  }
  
  console.log("Caption Buttons Found:", found);
  
  // Let's get the entire document body HTML and see what ARIA labels exist
  const bodyHtml = await page.evaluate(() => document.body.innerHTML);
  
  await browser.close();
}
run();
