import { NextResponse } from 'next/server';
import { scrapeWithAxios } from '../../lib/scrapers/axiosScraper';
import { scrapeWithCheerio } from '../../lib/scrapers/cheerioScraper';
import { scrapeWithPuppeteer } from '../../lib/scrapers/puppeteerScraper';

export async function POST(request: Request) {
  const requestTimestamp = new Date().toISOString();
  console.log(`[${requestTimestamp}] Received scrape request.`);

  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      console.error(`[${requestTimestamp}] Error: URL is required.`);
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    console.log(`[${requestTimestamp}] Processing URL: ${url}`);

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      console.error(`[${requestTimestamp}] Error: Invalid URL format for ${url}.`);
      return NextResponse.json({ error: 'Invalid URL format. Must start with http:// or https://' }, { status: 400 });
    }

    let axiosError: { message: string, timestamp: string } | null = null;
    let cheerioError: { message: string, timestamp: string } | null = null;
    let puppeteerError: { message: string, timestamp: string } | null = null;

    // For future enhancement, Axios and Cheerio could be run concurrently:
    // const results = await Promise.allSettled([scrapeWithAxios(url), scrapeWithCheerio(url)]);
    // Then, process results, prioritizing Cheerio's success or more comprehensive data,
    // before falling back to Puppeteer if both initial attempts are insufficient.

    // 1. Attempt Axios (Quickest, most basic)
    console.log(`[${requestTimestamp}] Attempting scrape with Axios for ${url}...`);
    try {
      const axiosScrapedText = await scrapeWithAxios(url);
      console.log(`[${requestTimestamp}] Axios scrape successful for ${url}. Strategy: axios`);
      return NextResponse.json({ scrapedText: axiosScrapedText, strategy: "axios", timestamp: new Date().toISOString() });
    } catch (error: any) {
      const errorTime = new Date().toISOString();
      console.warn(`[${errorTime}] Axios scraping attempt failed for ${url}: ${error.message}`);
      axiosError = { message: error.message, timestamp: errorTime };
    }

    // 2. Attempt Cheerio (If Axios failed)
    console.log(`[${requestTimestamp}] Axios failed for ${url}, trying Cheerio...`);
    try {
      const cheerioScrapedText = await scrapeWithCheerio(url);
      console.log(`[${requestTimestamp}] Cheerio scrape successful for ${url}. Strategy: cheerio`);
      return NextResponse.json({ scrapedText: cheerioScrapedText, strategy: "cheerio", timestamp: new Date().toISOString() });
    } catch (error: any) {
      const errorTime = new Date().toISOString();
      console.warn(`[${errorTime}] Cheerio scraping attempt failed for ${url}: ${error.message}`);
      cheerioError = { message: error.message, timestamp: errorTime };
    }

    // 3. Attempt Puppeteer (If Axios and Cheerio failed)
    console.log(`[${requestTimestamp}] Cheerio failed for ${url}, trying Puppeteer...`);
    try {
      const puppeteerScrapedText = await scrapeWithPuppeteer(url);
      console.log(`[${requestTimestamp}] Puppeteer scrape successful for ${url}. Strategy: puppeteer`);
      return NextResponse.json({ scrapedText: puppeteerScrapedText, strategy: "puppeteer", timestamp: new Date().toISOString() });
    } catch (error: any) {
      const errorTime = new Date().toISOString();
      console.warn(`[${errorTime}] Puppeteer scraping attempt failed for ${url}: ${error.message}`);
      puppeteerError = { message: error.message, timestamp: errorTime };
    }

    // 4. Handle combined results if all strategies failed
    const finalErrorTime = new Date().toISOString();
    console.error(`[${finalErrorTime}] All scraping strategies (Axios, Cheerio, Puppeteer) failed for ${url}.`);
    let combinedErrorMessage = 'All scraping strategies failed.';
    const errorDetails: { 
      axiosError?: { message: string, timestamp: string }, 
      cheerioError?: { message: string, timestamp: string }, 
      puppeteerError?: { message: string, timestamp: string } 
    } = {};

    if (axiosError) errorDetails.axiosError = axiosError;
    if (cheerioError) errorDetails.cheerioError = cheerioError;
    if (puppeteerError) errorDetails.puppeteerError = puppeteerError;
    
    return NextResponse.json({ 
      error: combinedErrorMessage,
      details: errorDetails,
      timestamp: finalErrorTime
    }, { status: 500 });

  } catch (error: any) {
    // Handles errors like invalid JSON in the request body or other unexpected errors.
    const overallErrorTime = new Date().toISOString();
    console.error(`[${overallErrorTime}] Overall error processing request:`, error instanceof Error ? error.message : error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON request body', timestamp: overallErrorTime }, { status: 400 });
    }
    return NextResponse.json({ error: 'An unexpected error occurred on the server.', timestamp: overallErrorTime }, { status: 500 });
  }
}
