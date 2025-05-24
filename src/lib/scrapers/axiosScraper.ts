/**
 * @file src/lib/scrapers/axiosScraper.ts
 * @description Axios-based web scraper.
 * This scraper uses Axios to fetch HTML content and Cheerio to parse it.
 * It extracts text content and image URLs, and attempts to detect if JavaScript is required for rendering.
 */

import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { cleanText, JavaScriptRequiredError } from '../utils';

// Constants for scraping behavior
const MIN_CONTENT_LENGTH = 50; // Minimum characters for a scrape to be considered successful
const JS_REQUIRED_CONTENT_THRESHOLD = 500; // Max text length to check for JS-required patterns if content is minimal
const AXIOS_TIMEOUT = 15000; // 15 seconds timeout for Axios requests

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
 * @function scrapeWithAxios
 * @description Scrapes a given URL using Axios to fetch HTML and Cheerio to parse.
 * @param {string} url - The URL to scrape.
 * @returns {Promise<ScrapedData>} A promise that resolves to the scraped data.
 * @throws {JavaScriptRequiredError} If the page content suggests JavaScript is required and not rendered.
 * @throws {Error} If scraping fails for other reasons (e.g., network error, invalid content type).
 */
export async function scrapeWithAxios(url: string): Promise<ScrapedData> {
  console.log(`Attempting Axios scrape for: ${url}`);
  try {
    // Perform GET request with Axios
    const response: AxiosResponse<string> = await axios.get(url, {
      timeout: AXIOS_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8' 
      },
      // Ensure only successful HTTP statuses are processed as valid
      validateStatus: function (status) {
        return status >= 200 && status < 300; 
      }
    });

    // Check content type
    const contentType = response.headers['content-type'];
    if (!contentType || !contentType.toLowerCase().includes('text/html')) {
      throw new Error(`Invalid content type: ${contentType}. Expected text/html.`);
    }

    const htmlString = response.data;
    const $ = cheerio.load(htmlString); // Load HTML into Cheerio

    // Remove non-content elements before text extraction (except noscript for JS check)
    $('script, style, iframe, embed, object, header, footer, nav, aside').remove();
    const textContent = cleanText($('body').text()); // Initial text extraction

    // Check for signs that JavaScript is required
    for (const pattern of jsRequiredPatterns) {
      if (pattern.test(htmlString) && textContent.length < JS_REQUIRED_CONTENT_THRESHOLD) {
        throw new JavaScriptRequiredError(`Content indicates JavaScript is required and was not rendered. Text length: ${textContent.length}. URL: ${url}`);
      }
    }
    
    // Remove <noscript> tags after the JS check and re-clean the text
    $('noscript').remove();
    const finalTextContent = cleanText($('body').text()); 

    // Validate content length
    if (finalTextContent.length < MIN_CONTENT_LENGTH) {
      throw new Error(`Axios extracted too little text (${finalTextContent.length} chars).`);
    }

    // Extract image URLs and alt text
    const images: { src: string; alt: string }[] = [];
    $('img').each((_, element) => {
      const src = $(element).attr('src');
      const alt = $(element).attr('alt') || ''; 
      if (src) {
        try {
          // Resolve relative URLs to absolute
          const absoluteSrc = new URL(src, url).href;
          images.push({ src: absoluteSrc, alt });
        } catch (e) {
          console.warn(`Invalid image URL found by Axios: ${src} on page ${url}`);
          // Optionally, could push original src if absolute resolution fails: images.push({ src, alt });
        }
      }
    });
    
    // Determine the final URL after any redirects
    const finalUrl = response.request?.res?.responseUrl || url;

    console.log(`Axios scrape successful for: ${url}. Final URL: ${finalUrl}. Text Length: ${finalTextContent.length}, Images Found: ${images.length}`);
    return { textContent: finalTextContent, images, finalUrl };

  } catch (error: any) {
    // Re-throw JavaScriptRequiredError directly if it's the cause
    if (error instanceof JavaScriptRequiredError) {
      throw error;
    }

    // Construct a detailed error message for other types of errors
    let errorMessage = `Axios failed for ${url}: `;
    if (axios.isAxiosError(error)) {
      if (error.response) {
        errorMessage += `Server responded with status ${error.response.status} - ${error.response.statusText}. `;
      } else if (error.request) {
        errorMessage += 'No response received from server. Check network or URL.';
      } else {
        errorMessage += `Request setup error - ${error.message}`;
      }
       if (error.code === 'ECONNABORTED') { // Axios timeout error code
        errorMessage += 'Request timed out.';
      }
    } else {
      // For non-Axios errors (e.g., our custom errors like content type)
      errorMessage += error.message;
    }
    console.error(errorMessage);
    throw new Error(errorMessage); 
  }
}
