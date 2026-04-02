import puppeteer from 'puppeteer';

async function run() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('https://meet.google.com/new', { waitUntil: 'networkidle2' });
  
  // Wait a bit
  await new Promise(r => setTimeout(r, 5000));
  
  // Dump all button aria labels
  const allButtons = await page.evaluate(() => {
     return Array.from(document.querySelectorAll('button')).map(b => b.getAttribute('aria-label')).filter(Boolean);
  });
  
  console.log("All Button Aria Labels:", allButtons);
  
  // Also dump body classes that end with certain things
  const allDivs = await page.evaluate(() => {
     return Array.from(document.querySelectorAll('div')).map(d => d.className).filter(Boolean);
  });
  // Too many divs, maybe just write it to a file
  
  await browser.close();
}
run();
