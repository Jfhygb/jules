import * as cheerio from 'cheerio';
import { cleanText } from '../utils';

const MIN_CONTENT_LENGTH = 100; // Minimum characters to consider a successful scrape

export async function scrapeWithCheerio(url: string): Promise<string> {
  console.log(`Attempting Cheerio scrape for: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL with Cheerio: ${response.status} ${response.statusText}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove script, style, and noscript tags more comprehensively
    $('script, style, noscript, link[rel="stylesheet"], meta[http-equiv="refresh"]').remove();
    
    // Try to get text from main content areas, then body
    let potentialText = 
      $('main').text() || 
      $('article').text() || 
      $('.post-content').text() || // Common class for blog post content
      $('.entry-content').text() || // Another common class
      $('#content').text() || // Common ID for main content
      $('body').text();
      
    const extractedText = cleanText(potentialText);

    if (extractedText.length < MIN_CONTENT_LENGTH) {
      throw new Error(`Cheerio extracted too little text (${extractedText.length} chars). Content might be dynamically loaded or not present in initial HTML.`);
    }
    
    console.log(`Cheerio scrape successful for: ${url}. Length: ${extractedText.length}`);
    return extractedText;
  } catch (error: any) {
    console.error(`Cheerio scraping error for ${url}:`, error.message);
    // Re-throw the error to be handled by the API route, possibly enriched.
    throw new Error(`Cheerio failed for ${url}: ${error.message}`);
  }
}
