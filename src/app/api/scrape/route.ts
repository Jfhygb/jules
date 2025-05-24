/**
 * @file src/app/api/scrape/route.ts
 * @description API route for scraping web content.
 * This route handles POST requests to scrape a given URL using various strategies (Axios, Cheerio, Puppeteer, Playwright).
 * It supports specifying a scraper agent or using a fallback chain.
 * It also handles URL extraction from path parameters, smart error handling for JS-dependent sites,
 * and returns scraped content (text and images) in Markdown format, along with the strategy used and the final URL.
 */

import { NextResponse } from 'next/server';
import { scrapeWithAxios } from '../../../lib/scrapers/axiosScraper';
import { scrapeWithCheerio } from '../../../lib/scrapers/cheerioScraper';
import { scrapeWithPuppeteer } from '../../../lib/scrapers/puppeteerScraper';
import { scrapeWithPlaywright } from '../../../lib/scrapers/playwrightScraper';
import { JavaScriptRequiredError } from '../../../lib/utils';

/**
 * @interface ScrapedData
 * @description Defines the structure of the data returned by scraper functions.
 * @property {string} textContent - The main textual content extracted from the page.
 * @property {{ src: string; alt: string }[]} images - An array of image objects, each with a source URL and alt text.
 * @property {string} finalUrl - The URL of the page after any redirects.
 */
interface ScrapedData {
  textContent: string;
  images: { src: string; alt: string }[];
  finalUrl: string; 
}

/**
 * @function formatToMarkdown
 * @description Converts the scraped data (text and images) into a Markdown string.
 * @param {ScrapedData} data - The scraped data object.
 * @returns {string} A Markdown formatted string.
 */
function formatToMarkdown(data: ScrapedData): string {
  let markdown = data.textContent;
  if (data.images && data.images.length > 0) {
    markdown += "\n\n## Images\n\n";
    data.images.forEach((image, index) => {
      const altText = image.alt || `Scraped Image ${index + 1}`;
      markdown += `![${altText}](${image.src})\n`;
    });
  }
  return markdown;
}

/**
 * @function POST
 * @description Handles POST requests to the /api/scrape endpoint.
 * It orchestrates the scraping process based on the request body parameters.
 * @param {Request} request - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} A promise that resolves to a Next.js response object.
 */
export async function POST(request: Request) {
  const requestTimestamp = new Date().toISOString();
  console.log(`[${requestTimestamp}] Received scrape request.`);

  try {
    const body = await request.json();
    let url = body.url;
    const scraperAgent = body.scraperAgent;
    const crawlDepth = body.crawlDepth || 0; // Default to 0 if not provided
    const searchDepth = body.searchDepth || 0; // Default to 0 if not provided

    console.log(`[${requestTimestamp}] URL: ${url}, Agent: ${scraperAgent}, Crawl Depth: ${crawlDepth}, Search Depth: ${searchDepth}`);


    if (url) {
      console.log(`[${requestTimestamp}] URL from JSON body: ${url}`);
    } else {
      // Attempt to extract URL from path if not in body
      const reqUrlObj = new URL(request.url); 
      const pathParts = reqUrlObj.pathname.split('/?sq/');
      if (pathParts.length > 1) {
        url = decodeURIComponent(pathParts[1]);
        console.log(`[${requestTimestamp}] Extracted URL from /?sq/ parameter: ${url}`);
      } else {
        console.log(`[${requestTimestamp}] URL not found in JSON body or /?sq/ path.`);
      }
    }

    // Validate URL presence
    if (!url) {
      console.error(`[${requestTimestamp}] Error: URL is required.`);
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    console.log(`[${requestTimestamp}] Processing URL: ${url}`);

    // Validate URL format
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      console.error(`[${requestTimestamp}] Error: Invalid URL format for ${url}.`);
      return NextResponse.json({ error: 'Invalid URL format. Must start with http:// or https://' }, { status: 400 });
    }

    // --- Agent-Specific Scraping Logic ---
    if (scraperAgent) {
      console.log(`[${requestTimestamp}] Specified scraper agent: ${scraperAgent} for URL: ${url}`);
      let scrapedData: ScrapedData;
      let strategy: string = scraperAgent; 
      let primaryAgentError: any = null;

      try {
        // Select and execute the specified scraper
        if (scraperAgent === "axios") {
          scrapedData = await scrapeWithAxios(url);
        } else if (scraperAgent === "cheerio") {
          scrapedData = await scrapeWithCheerio(url);
        } else if (scraperAgent === "puppeteer") {
          scrapedData = await scrapeWithPuppeteer(url);
        } else if (scraperAgent === "playwright") {
          scrapedData = await scrapeWithPlaywright(url);
        } else {
          // Handle invalid scraper agent
          console.error(`[${requestTimestamp}] Error: Invalid scraper agent specified: ${scraperAgent} for URL: ${url}`);
          return NextResponse.json({ error: `Invalid scraper agent specified: ${scraperAgent}. Valid options are "axios", "cheerio", "puppeteer", "playwright".` }, { status: 400 });
        }
        
        // Format and return successful scrape
        const markdownContent = formatToMarkdown(scrapedData);
        console.log(`[${requestTimestamp}] ${strategy} scrape successful for ${url}. Strategy: ${strategy}, Final URL: ${scrapedData.finalUrl}`);
        return NextResponse.json({ 
          scrapedText: markdownContent, 
          strategy, 
          finalUrl: scrapedData.finalUrl, 
          images: scrapedData.images, 
          timestamp: new Date().toISOString() 
        });
      } catch (error: any) {
        primaryAgentError = error; 
        const errorTime = new Date().toISOString();
        console.error(`[${errorTime}] Specified agent ${scraperAgent} failed for ${url}: ${error.message}`);

        // Smart fallback for Axios or Cheerio if JavaScriptRequiredError is thrown
        if ((scraperAgent === "axios" || scraperAgent === "cheerio") && error instanceof JavaScriptRequiredError) {
          console.log(`[${requestTimestamp}] ${scraperAgent} failed due to JS requirement, attempting fallback to Puppeteer for ${url}. Original error: ${error.message}`);
          try {
            // Attempt Puppeteer
            strategy = "puppeteer"; 
            scrapedData = await scrapeWithPuppeteer(url);
            const markdownContent = formatToMarkdown(scrapedData);
            const fallbackStrategy = `puppeteer (fallback from ${scraperAgent})`;
            console.log(`[${requestTimestamp}] Puppeteer scrape successful (fallback from ${scraperAgent} JS error) for ${url}. Strategy: ${fallbackStrategy}, Final URL: ${scrapedData.finalUrl}`);
            return NextResponse.json({ 
              scrapedText: markdownContent, 
              strategy: fallbackStrategy, 
              finalUrl: scrapedData.finalUrl,
              images: scrapedData.images,
              timestamp: new Date().toISOString(), 
              originalAgentError: error.message 
            });
          } catch (puppeteerError: any) {
            // Puppeteer also failed, try Playwright
            const puppeteerErrorTime = new Date().toISOString();
            console.warn(`[${puppeteerErrorTime}] Puppeteer fallback attempt failed for ${url}: ${puppeteerError.message}. Trying Playwright...`);
            try {
              strategy = "playwright"; 
              scrapedData = await scrapeWithPlaywright(url);
              const markdownContent = formatToMarkdown(scrapedData);
              const fallbackStrategy = `playwright (fallback from puppeteer after ${scraperAgent})`;
              console.log(`[${requestTimestamp}] Playwright scrape successful (fallback from Puppeteer after ${scraperAgent} JS error) for ${url}. Strategy: ${fallbackStrategy}, Final URL: ${scrapedData.finalUrl}`);
              return NextResponse.json({ 
                scrapedText: markdownContent, 
                strategy: fallbackStrategy, 
                finalUrl: scrapedData.finalUrl,
                images: scrapedData.images,
                timestamp: new Date().toISOString(), 
                originalAgentError: error.message, 
                puppeteerFallbackError: puppeteerError.message 
              });
            } catch (playwrightError: any) {
              // Playwright also failed
              const playwrightErrorTime = new Date().toISOString();
              console.error(`[${playwrightErrorTime}] Playwright fallback also failed for ${url}: ${playwrightError.message}`);
              return NextResponse.json({ 
                error: `Scraping with ${scraperAgent} (JS error), Puppeteer (fallback), and Playwright (fallback) all failed. Playwright error: ${playwrightError.message}`, 
                strategy: `playwright (fallback)`, 
                originalAgentError: error.message,
                puppeteerError: puppeteerError.message,
                playwrightError: playwrightError.message,
                timestamp: playwrightErrorTime 
              }, { status: 500 });
            }
          }
        }
        // If not a JavaScriptRequiredError or not Axios/Cheerio, return the original error for the specified agent
        return NextResponse.json({ 
          error: `Scraping with ${scraperAgent} failed: ${error.message}`, 
          strategy: scraperAgent, 
          timestamp: errorTime 
        }, { status: 500 });
      }
    } else {
      // --- Fallback Chain Logic (No specific agent provided) ---
      console.log(`[${requestTimestamp}] No specific scraper agent provided, using smart fallback chain for URL: ${url}`);
      let errorDetails: any = {};
      let lastErrorTimestamp = new Date().toISOString();

      // 1. Attempt Axios
      console.log(`[${requestTimestamp}] Attempting scrape with Axios for ${url}...`);
      try {
        const axiosScrapedData = await scrapeWithAxios(url);
        const markdownContent = formatToMarkdown(axiosScrapedData);
        console.log(`[${requestTimestamp}] Axios scrape successful for ${url}. Strategy: axios, Final URL: ${axiosScrapedData.finalUrl}`);
        return NextResponse.json({ 
          scrapedText: markdownContent, 
          strategy: "axios", 
          finalUrl: axiosScrapedData.finalUrl,
          images: axiosScrapedData.images,
          timestamp: new Date().toISOString() 
        });
      } catch (axiosError: any) {
        lastErrorTimestamp = new Date().toISOString();
        console.warn(`[${lastErrorTimestamp}] Axios scraping attempt failed for ${url}: ${axiosError.message}`);
        errorDetails.axiosError = { message: axiosError.message, timestamp: lastErrorTimestamp };

        if (axiosError instanceof JavaScriptRequiredError) {
          console.log(`[${requestTimestamp}] Axios failed due to JS requirement, skipping Cheerio, trying Puppeteer for ${url}.`);
          // Fallthrough to Puppeteer (skips Cheerio)
        } else {
          // 2. Attempt Cheerio (if Axios failed for a non-JS reason)
          console.log(`[${requestTimestamp}] Axios failed (non-JS), trying Cheerio for ${url}...`);
          try {
            const cheerioScrapedData = await scrapeWithCheerio(url);
            const markdownContent = formatToMarkdown(cheerioScrapedData);
            console.log(`[${requestTimestamp}] Cheerio scrape successful for ${url}. Strategy: cheerio, Final URL: ${cheerioScrapedData.finalUrl}`);
            return NextResponse.json({ 
              scrapedText: markdownContent, 
              strategy: "cheerio", 
              finalUrl: cheerioScrapedData.finalUrl,
              images: cheerioScrapedData.images,
              timestamp: new Date().toISOString() 
            });
          } catch (cheerioError: any) {
            lastErrorTimestamp = new Date().toISOString();
            console.warn(`[${lastErrorTimestamp}] Cheerio scraping attempt failed for ${url}: ${cheerioError.message}`);
            errorDetails.cheerioError = { message: cheerioError.message, timestamp: lastErrorTimestamp };
            if (cheerioError instanceof JavaScriptRequiredError) {
              console.log(`[${requestTimestamp}] Cheerio failed due to JS requirement (after Axios non-JS fail), trying Puppeteer for ${url}.`);
              // Fallthrough to Puppeteer
            }
            // If Cheerio fails for other reasons, still fallthrough to Puppeteer
          }
        }
      }

      // 3. Attempt Puppeteer (if Axios/Cheerio failed or indicated JS requirement)
      console.log(`[${requestTimestamp}] Trying Puppeteer for ${url} (due to previous failure or JS requirement)...`);
      try {
        const puppeteerScrapedData = await scrapeWithPuppeteer(url);
        const markdownContent = formatToMarkdown(puppeteerScrapedData);
        console.log(`[${requestTimestamp}] Puppeteer scrape successful for ${url}. Strategy: puppeteer, Final URL: ${puppeteerScrapedData.finalUrl}`);
        return NextResponse.json({ 
          scrapedText: markdownContent, 
          strategy: "puppeteer", 
          finalUrl: puppeteerScrapedData.finalUrl,
          images: puppeteerScrapedData.images,
          timestamp: new Date().toISOString() 
        });
      } catch (puppeteerError: any) {
        lastErrorTimestamp = new Date().toISOString();
        console.warn(`[${lastErrorTimestamp}] Puppeteer scraping attempt failed for ${url}: ${puppeteerError.message}`);
        errorDetails.puppeteerError = { message: puppeteerError.message, timestamp: lastErrorTimestamp };
      }

      // 4. Attempt Playwright (if all above failed)
      console.log(`[${requestTimestamp}] Trying Playwright for ${url} (due to previous failures)...`);
      try {
        const playwrightScrapedData = await scrapeWithPlaywright(url);
        const markdownContent = formatToMarkdown(playwrightScrapedData);
        console.log(`[${requestTimestamp}] Playwright scrape successful for ${url}. Strategy: playwright, Final URL: ${playwrightScrapedData.finalUrl}`);
        return NextResponse.json({ 
          scrapedText: markdownContent, 
          strategy: "playwright", 
          finalUrl: playwrightScrapedData.finalUrl,
          images: playwrightScrapedData.images,
          timestamp: new Date().toISOString() 
        });
      } catch (playwrightError: any) {
        lastErrorTimestamp = new Date().toISOString();
        console.warn(`[${lastErrorTimestamp}] Playwright scraping attempt failed for ${url}: ${playwrightError.message}`);
        errorDetails.playwrightError = { message: playwrightError.message, timestamp: lastErrorTimestamp };
      }
      
      // 5. Handle combined results if all strategies failed
      console.error(`[${lastErrorTimestamp}] All scraping strategies failed for ${url}.`);
      return NextResponse.json({ 
        error: 'All scraping strategies failed.',
        details: errorDetails,
        timestamp: lastErrorTimestamp // Use the timestamp of the last error
      }, { status: 500 });
    }

  } catch (error: any) {
    // --- Overall Error Handling (e.g., invalid JSON body) ---
    const overallErrorTime = new Date().toISOString();
    console.error(`[${overallErrorTime}] Overall error processing request:`, error instanceof Error ? error.message : error);
    if (error instanceof SyntaxError && error.message.includes("JSON")) { 
        console.error(`[${overallErrorTime}] Error: Invalid JSON request body.`);
        return NextResponse.json({ error: 'Invalid JSON request body', timestamp: overallErrorTime }, { status: 400 });
    }
    return NextResponse.json({ error: 'An unexpected error occurred on the server.', details: error instanceof Error ? error.message : String(error), timestamp: overallErrorTime }, { status: 500 });
  }
}
