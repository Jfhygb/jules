/**
 * @file src/lib/scrapers/cheerioScraper.ts
 * @description Cheerio-based web scraper.
 * This scraper uses the `fetch` API to get HTML content and Cheerio to parse it.
 * It's designed for static sites or to get the initial HTML of dynamic sites.
 * It extracts text content and image URLs, and attempts to detect if JavaScript is required for full rendering.
 */

import * as cheerio from 'cheerio';
import { cleanText, JavaScriptRequiredError } from '../utils';

// Constants for scraping behavior
const MIN_CONTENT_LENGTH = 100; // Minimum characters for a scrape to be considered successful
const JS_REQUIRED_CONTENT_THRESHOLD = 500; // Max text length to check for JS-required patterns if content is minimal

// Regex patterns to detect if a page requires JavaScript
const jsRequiredPatterns = [
  /you need to enable javascript/i,
  /enable javascript to continue/i,
  /javascript is required/i,
  /javascript is disabled/i,
  /requires javascript/i,
  /doesn't work unless you turn on javascript/i,
  /<noscript.*>javascript is required<\/noscript>/i, 
  /please enable javascript/i,
  /to use this site, please enable javascript/i,
  /this site requires javascript/i
];

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
 * @function scrapeWithCheerio
 * @description Scrapes a given URL using `fetch` and Cheerio.
 * @param {string} url - The URL to scrape.
 * @returns {Promise<ScrapedData>} A promise that resolves to the scraped data.
 * @throws {JavaScriptRequiredError} If the page content suggests JavaScript is required and not rendered.
 * @throws {Error} If scraping fails for other reasons (e.g., network error, non-OK HTTP response).
 */
export async function scrapeWithCheerio(url: string): Promise<ScrapedData> {
  console.log(`Attempting Cheerio scrape for: ${url}`);
  try {
    // Fetch the HTML content of the page
    const fetchResponse = await fetch(url); 
    if (!fetchResponse.ok) {
      throw new Error(`Failed to fetch URL with Cheerio: ${fetchResponse.status} ${fetchResponse.statusText}`);
    }
    const finalUrl = fetchResponse.url; // URL after any redirects
    const html = await fetchResponse.text();
    const $ = cheerio.load(html); // Load HTML into Cheerio

    // Initial text extraction (with noscript tags) to gauge content before JS check
    let tempTextContent = cleanText($('body').text()); 

    // Check for signs that JavaScript is required based on patterns and minimal content
    for (const pattern of jsRequiredPatterns) {
      if (pattern.test(html) && tempTextContent.length < JS_REQUIRED_CONTENT_THRESHOLD) {
        let noscriptMessage = "";
        // Specifically check content of <noscript> tags for keywords
        $('noscript').each((i, el) => {
          const noscriptText = $(el).text();
          if (jsRequiredPatterns.some(p => p.test(noscriptText))) {
            noscriptMessage += cleanText(noscriptText) + " ";
          }
        });
        if (noscriptMessage.trim().length > 0) {
             throw new JavaScriptRequiredError(`Content indicates JavaScript is required (via noscript tag: "${noscriptMessage.trim()}"). URL: ${url}`);
        }
        // Generic message if specific noscript check fails but pattern matches in HTML
        throw new JavaScriptRequiredError(`Content indicates JavaScript is required (pattern matched in HTML, text length: ${tempTextContent.length}). URL: ${url}`);
      }
    }
    
    // Remove script, style, noscript, and other non-content tags
    $('script, style, noscript, link[rel="stylesheet"], meta[http-equiv="refresh"]').remove();
    
    // Prioritize text from main content elements, falling back to body
    let potentialText = 
      $('main').text() || 
      $('article').text() || 
      $('.post-content').text() || 
      $('.entry-content').text() || 
      $('#content').text() || 
      $('body').text(); 
      
    const textContent = cleanText(potentialText); // Clean the extracted text

    // Validate content length
    if (textContent.length < MIN_CONTENT_LENGTH) {
      throw new Error(`Cheerio extracted too little text (${textContent.length} chars). Content might be dynamically loaded or not present in initial HTML.`);
    }

    // Extract image URLs and alt text
    const images: { src: string; alt: string }[] = [];
    $('img').each((_, element) => {
      const src = $(element).attr('src');
      const alt = $(element).attr('alt') || ''; 
      if (src) {
        try {
          // Resolve relative URLs to absolute
          const absoluteSrc = new URL(src, finalUrl).href; // Use finalUrl as base
          images.push({ src: absoluteSrc, alt });
        } catch (e) {
          console.warn(`Invalid image URL found by Cheerio: ${src} on page ${finalUrl}`);
        }
      }
    });
    
    console.log(`Cheerio scrape successful for: ${url}. Final URL: ${finalUrl}. Text Length: ${textContent.length}, Images Found: ${images.length}`);
    return { textContent, images, finalUrl };
  } catch (error: any) {
    // Re-throw JavaScriptRequiredError directly
    if (error instanceof JavaScriptRequiredError) {
      throw error;
    }
    // Handle other errors
    console.error(`Cheerio scraping error for ${url}:`, error.message);
    throw new Error(`Cheerio failed for ${url}: ${error.message}`);
  }
}
