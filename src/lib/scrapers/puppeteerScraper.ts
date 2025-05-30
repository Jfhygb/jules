/**
 * @file src/lib/scrapers/puppeteerScraper.ts
 * @description Puppeteer-based web scraper.
 * This scraper uses Puppeteer to launch a headless browser, render the page (including JavaScript),
 * and then extract text content and image URLs.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { cleanText } from '../utils';

const MIN_CONTENT_LENGTH = 100; // Minimum characters for a scrape to be considered successful

/**
 * @interface ScrapedData
 * @description Defines the structure of the data returned by this scraper.
 * @property {string} textContent - The main textual content extracted from the page.
 * @property {{ src: string; alt: string }[]} images - An array of image objects.
 * @property {string} finalUrl - The URL of the page after any redirects.
 */
interface ScrapedData {
  textContent: string;
  images: { src: string; alt: string }[];
  finalUrl: string;
}

/**
 * @function scrapeWithPuppeteer
 * @description Scrapes a given URL using Puppeteer.
 * @param {string} url - The URL to scrape.
 * @returns {Promise<ScrapedData>} A promise that resolves to the scraped data.
 * @throws {Error} If scraping fails (e.g., navigation error, content extraction issues).
 */
export async function scrapeWithPuppeteer(url: string): Promise<ScrapedData> {
  console.log(`Attempting Puppeteer scrape for: ${url}`);
  let browser: Browser | null = null;
  try {
    // Launch Puppeteer browser
    browser = await puppeteer.launch({
      headless: "new", // Use the new headless mode
      args: [ // Common arguments for running in restricted environments (like Docker/CI)
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu' // Often necessary in headless environments
      ],
    });
    const page: Page = await browser.newPage();
    
    // Configure page settings
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    console.log(`Puppeteer navigating to: ${url}`);
    // Navigate to the URL and wait for network activity to cease
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 }); 

    // --- Content Extraction Logic ---
    // Remove non-content elements from the DOM before extracting text and images
    await page.evaluate(() => {
      const selectorsToRemove = [
        'script', 'style', 'noscript', 'iframe', 'embed', 'object',
        'header', 'footer', 'nav', 'aside', 
        '.advertisement', '.banner', '.popup', '.modal', '#cookie-banner', 
        '.share-buttons', '.social-media-links', '.sidebar',
        'button', 'form[action*="subscribe"]' 
      ];
      selectorsToRemove.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => el.remove());
      });
    });
    
    // Extract text content and image data from the page context
    const extractedData = await page.evaluate(() => {
      // Prioritize main content areas, then fall back to the whole body
      const textContent = (document.querySelector('main') || document.querySelector('article') || document.querySelector('[role="main"]') || document.body).innerText;
      
      const imagesArray: { src: string; alt: string }[] = [];
      document.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src');
        const alt = img.getAttribute('alt') || '';
        if (src) {
          imagesArray.push({ src, alt });
        }
      });
      return { textContent, images: imagesArray };
    });

    const textContent = cleanText(extractedData.textContent); // Clean the extracted text

    // Validate content length
    if (textContent.length < MIN_CONTENT_LENGTH) {
      throw new Error(`Puppeteer extracted too little text (${textContent.length} chars).`);
    }

    // Process image URLs to make them absolute
    const images = extractedData.images.map(img => {
      try {
        // Resolve relative URLs using the page's final URL as base
        return { src: new URL(img.src, page.url()).href, alt: img.alt };
      } catch (e) {
        console.warn(`Invalid image URL found by Puppeteer: ${img.src} on page ${page.url()}`);
        return { src: img.src, alt: img.alt }; // Keep original if invalid
      }
    }).filter(img => img.src); // Ensure src is not empty after potential error
    
    const finalUrl = page.url(); // Get the final URL after any redirects
    console.log(`Puppeteer scrape successful for: ${url}. Final URL: ${finalUrl}. Text Length: ${textContent.length}, Images Found: ${images.length}`);
    return { textContent, images, finalUrl };
  } catch (error: any) {
    console.error(`Puppeteer scraping error for ${url}:`, error.message);
    throw new Error(`Puppeteer failed for ${url}: ${error.message}`);
  } finally {
    // Ensure browser is closed
    if (browser) {
      console.log(`Closing Puppeteer browser for ${url}...`);
      await browser.close();
    }
  }
}
