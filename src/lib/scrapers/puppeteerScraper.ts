import puppeteer, { Browser } from 'puppeteer';
import { cleanText } from '../utils';


const MIN_CONTENT_LENGTH = 100; // Minimum characters to consider a successful scrape

export async function scrapeWithPuppeteer(url: string): Promise<string> {
  console.log(`Attempting Puppeteer scrape for: ${url}`);
  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Common in Docker/CI environments
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        // '--single-process', // May be useful in some environments, but can also cause issues
        '--disable-gpu'
      ],
    });
    const page = await browser.newPage();
    
    // Set a reasonable viewport
    await page.setViewport({ width: 1280, height: 800 });
    // Set a user agent to mimic a real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    console.log(`Puppeteer navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 }); // 60s timeout

    // Try to remove elements that are typically not part of main content before extracting text
    await page.evaluate(() => {
      const selectorsToRemove = [
        'script', 'style', 'noscript', 'iframe', 'embed', 'object',
        'header', 'footer', 'nav', 'aside', 
        '.advertisement', '.banner', '.popup', '.modal', '#cookie-banner', 
        '.share-buttons', '.social-media-links', '.sidebar',
        'button', 'form[action*="subscribe"]' // Remove common CTAs and forms
      ];
      selectorsToRemove.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => el.remove());
      });
    });
    
    let puppeteerBodyText = await page.evaluate(() => {
      // Try to get main content first, then fallback to body
      const mainContent = document.querySelector('main') || document.querySelector('article') || document.querySelector('[role="main"]');
      return mainContent ? mainContent.innerText : document.body.innerText;
    });
    const extractedText = cleanText(puppeteerBodyText);

    if (extractedText.length < MIN_CONTENT_LENGTH) {
      throw new Error(`Puppeteer extracted too little text (${extractedText.length} chars).`);
    }
    
    console.log(`Puppeteer scrape successful for: ${url}. Length: ${extractedText.length}`);
    return extractedText;
  } catch (error: any) {
    console.error(`Puppeteer scraping error for ${url}:`, error.message);
    throw new Error(`Puppeteer failed for ${url}: ${error.message}`);
  } finally {
    if (browser) {
      console.log(`Closing Puppeteer browser for ${url}...`);
      await browser.close();
    }
  }
}
