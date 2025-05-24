import { POST } from '../../../app/api/scrape/route'; // Adjust path as necessary
import { scrapeWithAxios } from '../../../lib/scrapers/axiosScraper';
import { scrapeWithCheerio } from '../../../lib/scrapers/cheerioScraper';
import { scrapeWithPuppeteer } from '../../../lib/scrapers/puppeteerScraper';
import { scrapeWithPlaywright } from '../../../lib/scrapers/playwrightScraper';
import { JavaScriptRequiredError } from '../../../lib/utils';
import { NextResponse } from 'next/server';

// Mock all scraper functions
jest.mock('../../../lib/scrapers/axiosScraper');
jest.mock('../../../lib/scrapers/cheerioScraper');
jest.mock('../../../lib/scrapers/puppeteerScraper');
jest.mock('../../../lib/scrapers/playwrightScraper');

// Mock NextResponse
// jest.mock('next/server', () => ({
//   NextResponse: {
//     json: jest.fn((body, init) => ({ // Simplified mock, can be more detailed
//       json: async () => body,
//       status: init?.status || 200,
//       ok: (init?.status || 200) >= 200 && (init?.status || 200) < 300,
//     })),
//   },
// }));
// The above mock for NextResponse is tricky because NextResponse is a class.
// It's often easier to spy on NextResponse.json if it's directly used or let it be,
// and then assert the result of `await response.json()` and `response.status`.

const mockedScrapeWithAxios = scrapeWithAxios as jest.MockedFunction<typeof scrapeWithAxios>;
const mockedScrapeWithCheerio = scrapeWithCheerio as jest.MockedFunction<typeof scrapeWithCheerio>;
const mockedScrapeWithPuppeteer = scrapeWithPuppeteer as jest.MockedFunction<typeof scrapeWithPuppeteer>;
const mockedScrapeWithPlaywright = scrapeWithPlaywright as jest.MockedFunction<typeof scrapeWithPlaywright>;


// Helper to create a mock Request object
const createMockRequest = (body: any, path: string = ''): Request => {
  const url = `http://localhost:3000${path}`; // Base URL doesn't matter much for these tests
  return {
    json: async () => body,
    url: url,
    // Add other properties/methods if your POST function uses them
  } as Request;
};

const mockScrapedData = (text: string, finalUrl: string, images: {src: string, alt: string}[] = []) => ({
  textContent: text,
  images: images,
  finalUrl: finalUrl,
});


describe('API Route: /api/scrape', () => {
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console output during tests for clarity, can be enabled for debugging
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterAll(() => {
    // Restore console output
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });
  
  // --- Test Cases ---

  describe('Agent Selection', () => {
    it('should call only scrapeWithAxios when scraperAgent is "axios"', async () => {
      const mockData = mockScrapedData('Axios content', 'http://example.com/axios');
      mockedScrapeWithAxios.mockResolvedValue(mockData);
      const request = createMockRequest({ url: 'http://example.com', scraperAgent: 'axios' });
      
      const response = await POST(request);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(mockedScrapeWithAxios).toHaveBeenCalledWith('http://example.com');
      expect(mockedScrapeWithCheerio).not.toHaveBeenCalled();
      expect(mockedScrapeWithPuppeteer).not.toHaveBeenCalled();
      expect(mockedScrapeWithPlaywright).not.toHaveBeenCalled();
      expect(responseBody.strategy).toBe('axios');
      expect(responseBody.scrapedText).toContain('Axios content');
      expect(responseBody.finalUrl).toBe('http://example.com/axios');
    });
    // Similar tests for cheerio, puppeteer, playwright if needed
  });

  describe('Default Fallback Chain', () => {
    it('should use Cheerio if Axios fails (generic error)', async () => {
      mockedScrapeWithAxios.mockRejectedValue(new Error('Axios generic fail'));
      const mockCheerioData = mockScrapedData('Cheerio content', 'http://example.com/cheerio');
      mockedScrapeWithCheerio.mockResolvedValue(mockCheerioData);
      const request = createMockRequest({ url: 'http://example.com' });

      const response = await POST(request);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(mockedScrapeWithAxios).toHaveBeenCalled();
      expect(mockedScrapeWithCheerio).toHaveBeenCalled();
      expect(mockedScrapeWithPuppeteer).not.toHaveBeenCalled();
      expect(responseBody.strategy).toBe('cheerio');
      expect(responseBody.scrapedText).toContain('Cheerio content');
    });

    it('should use Puppeteer if Axios and Cheerio fail (generic errors)', async () => {
      mockedScrapeWithAxios.mockRejectedValue(new Error('Axios generic fail'));
      mockedScrapeWithCheerio.mockRejectedValue(new Error('Cheerio generic fail'));
      const mockPuppeteerData = mockScrapedData('Puppeteer content', 'http://example.com/puppeteer');
      mockedScrapeWithPuppeteer.mockResolvedValue(mockPuppeteerData);
      const request = createMockRequest({ url: 'http://example.com' });

      const response = await POST(request);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(mockedScrapeWithPuppeteer).toHaveBeenCalled();
      expect(responseBody.strategy).toBe('puppeteer');
    });
    
    it('should use Playwright if Axios, Cheerio, and Puppeteer fail (generic errors)', async () => {
      mockedScrapeWithAxios.mockRejectedValue(new Error('Axios generic fail'));
      mockedScrapeWithCheerio.mockRejectedValue(new Error('Cheerio generic fail'));
      mockedScrapeWithPuppeteer.mockRejectedValue(new Error('Puppeteer generic fail'));
      const mockPlaywrightData = mockScrapedData('Playwright content', 'http://example.com/playwright');
      mockedScrapeWithPlaywright.mockResolvedValue(mockPlaywrightData);
      const request = createMockRequest({ url: 'http://example.com' });

      const response = await POST(request);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(mockedScrapeWithPlaywright).toHaveBeenCalled();
      expect(responseBody.strategy).toBe('playwright');
    });
  });

  describe('JavaScriptRequiredError Handling', () => {
    it('should skip Cheerio and call Puppeteer if Axios throws JavaScriptRequiredError in fallback', async () => {
      mockedScrapeWithAxios.mockRejectedValue(new JavaScriptRequiredError('Axios JS fail'));
      const mockPuppeteerData = mockScrapedData('Puppeteer content after Axios JS fail', 'http://example.com/puppeteer');
      mockedScrapeWithPuppeteer.mockResolvedValue(mockPuppeteerData);
      const request = createMockRequest({ url: 'http://example.com' });

      const response = await POST(request);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(mockedScrapeWithAxios).toHaveBeenCalled();
      expect(mockedScrapeWithCheerio).not.toHaveBeenCalled(); // Crucial check
      expect(mockedScrapeWithPuppeteer).toHaveBeenCalled();
      expect(responseBody.strategy).toBe('puppeteer');
    });

    it('should call Puppeteer if Axios fails (generic) and Cheerio throws JavaScriptRequiredError in fallback', async () => {
      mockedScrapeWithAxios.mockRejectedValue(new Error('Axios generic fail'));
      mockedScrapeWithCheerio.mockRejectedValue(new JavaScriptRequiredError('Cheerio JS fail'));
      const mockPuppeteerData = mockScrapedData('Puppeteer content after Cheerio JS fail', 'http://example.com/puppeteer');
      mockedScrapeWithPuppeteer.mockResolvedValue(mockPuppeteerData);
      const request = createMockRequest({ url: 'http://example.com' });

      const response = await POST(request);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(mockedScrapeWithAxios).toHaveBeenCalled();
      expect(mockedScrapeWithCheerio).toHaveBeenCalled();
      expect(mockedScrapeWithPuppeteer).toHaveBeenCalled();
      expect(responseBody.strategy).toBe('puppeteer');
    });
    
    it('should fallback to Puppeteer then Playwright if selected agent "axios" throws JavaScriptRequiredError', async () => {
      mockedScrapeWithAxios.mockRejectedValue(new JavaScriptRequiredError('Axios JS fail direct select'));
      mockedScrapeWithPuppeteer.mockRejectedValue(new Error('Puppeteer fallback fail'));
      const mockPlaywrightData = mockScrapedData('Playwright content after Axios JS + Puppeteer fail', 'http://example.com/playwright');
      mockedScrapeWithPlaywright.mockResolvedValue(mockPlaywrightData);

      const request = createMockRequest({ url: 'http://example.com', scraperAgent: 'axios' });
      const response = await POST(request);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(mockedScrapeWithAxios).toHaveBeenCalled();
      expect(mockedScrapeWithPuppeteer).toHaveBeenCalled();
      expect(mockedScrapeWithPlaywright).toHaveBeenCalled();
      expect(responseBody.strategy).toBe('playwright (fallback from puppeteer after axios)');
      expect(responseBody.originalAgentError).toContain('Axios JS fail direct select');
      expect(responseBody.puppeteerFallbackError).toContain('Puppeteer fallback fail');
    });
  });

  describe('Invalid Inputs', () => {
    it('should return 400 for missing URL', async () => {
      const request = createMockRequest({}); // No URL in body
      const response = await POST(request);
      const responseBody = await response.json();
      expect(response.status).toBe(400);
      expect(responseBody.error).toBe('URL is required');
    });

    it('should return 400 for invalid URL format', async () => {
      const request = createMockRequest({ url: 'invalid-url' });
      const response = await POST(request);
      const responseBody = await response.json();
      expect(response.status).toBe(400);
      expect(responseBody.error).toBe('Invalid URL format. Must start with http:// or https://');
    });

    it('should return 400 for invalid scraperAgent', async () => {
      const request = createMockRequest({ url: 'http://example.com', scraperAgent: 'invalidAgent' });
      const response = await POST(request);
      const responseBody = await response.json();
      expect(response.status).toBe(400);
      expect(responseBody.error).toContain('Invalid scraper agent specified: invalidAgent');
    });
  });

  describe('All Scrapers Fail', () => {
    it('should return 500 if all scrapers in fallback chain fail', async () => {
      mockedScrapeWithAxios.mockRejectedValue(new Error('Axios fail'));
      mockedScrapeWithCheerio.mockRejectedValue(new Error('Cheerio fail'));
      mockedScrapeWithPuppeteer.mockRejectedValue(new Error('Puppeteer fail'));
      mockedScrapeWithPlaywright.mockRejectedValue(new Error('Playwright fail'));
      const request = createMockRequest({ url: 'http://example.com' });

      const response = await POST(request);
      const responseBody = await response.json();

      expect(response.status).toBe(500);
      expect(responseBody.error).toBe('All scraping strategies failed.');
      expect(responseBody.details.axiosError.message).toBe('Axios fail');
      expect(responseBody.details.playwrightError.message).toBe('Playwright fail');
    });
  });
  
  describe('URL Extraction', () => {
    it('should extract URL from /?sq/ path if not in body', async () => {
      const mockData = mockScrapedData('Path extracted content', 'http://path-url.com/page');
      mockedScrapeWithAxios.mockResolvedValue(mockData); // Assume Axios is hit in fallback
      const request = createMockRequest(
        {}, // Empty body
        `/api/scrape/?sq/${encodeURIComponent('http://path-url.com/page')}`
      );
      
      const response = await POST(request);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      // Verify that the extracted URL was used for scraping
      expect(mockedScrapeWithAxios).toHaveBeenCalledWith('http://path-url.com/page');
      expect(responseBody.scrapedText).toContain('Path extracted content');
      expect(responseBody.finalUrl).toBe('http://path-url.com/page');
    });

    it('should correctly handle URL with query parameters in /?sq/ path', async () => {
      const targetUrlWithQuery = 'http://path-url.com/page?param=value&another=123';
      const mockData = mockScrapedData('Path extracted content with query', targetUrlWithQuery);
      mockedScrapeWithAxios.mockResolvedValue(mockData);
      const request = createMockRequest(
        {},
        `/api/scrape/?sq/${encodeURIComponent(targetUrlWithQuery)}` 
      );
      const response = await POST(request);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(mockedScrapeWithAxios).toHaveBeenCalledWith(targetUrlWithQuery);
      expect(responseBody.finalUrl).toBe(targetUrlWithQuery);
    });
  });

  describe('Markdown Output', () => {
    it('should correctly format text and images into Markdown', async () => {
      const testUrl = 'http://example.com/markdown-test';
      const mockData = mockScrapedData(
        'Markdown test content.',
        testUrl,
        [
          { src: 'http://example.com/img1.jpg', alt: 'Alt for Img1' },
          { src: 'http://example.com/img2.png', alt: '' }, // Empty alt
        ]
      );
      mockedScrapeWithAxios.mockResolvedValue(mockData); // Assume Axios is used
      const request = createMockRequest({ url: testUrl, scraperAgent: 'axios' });
      
      const response = await POST(request);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.scrapedText).toContain('Markdown test content.');
      expect(responseBody.scrapedText).toContain('## Images');
      expect(responseBody.scrapedText).toContain('![Alt for Img1](http://example.com/img1.jpg)');
      expect(responseBody.scrapedText).toContain('![Scraped Image 2](http://example.com/img2.png)'); // Default alt
      expect(responseBody.images).toEqual(mockData.images); // Raw images also passed
    });
  });
});
