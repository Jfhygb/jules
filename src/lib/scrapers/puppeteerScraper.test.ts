import puppeteer from 'puppeteer';
import { scrapeWithPuppeteer } from './puppeteerScraper';
// We don't typically throw JavaScriptRequiredError from Puppeteer/Playwright
// as they are expected to handle JS. So, not importing it here for specific error checks.

// Mock puppeteer
jest.mock('puppeteer');

const mockedPuppeteer = puppeteer as jest.Mocked<typeof puppeteer>;

describe('scrapeWithPuppeteer', () => {
  let mockPage: any;
  let mockBrowser: any;

  beforeEach(() => {
    // Reset mocks for each test
    mockPage = {
      setViewport: jest.fn(),
      setUserAgent: jest.fn(),
      goto: jest.fn(),
      evaluate: jest.fn(),
      url: jest.fn(),
    };
    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    };
    mockedPuppeteer.launch.mockResolvedValue(mockBrowser as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should scrape text and images correctly and return finalUrl', async () => {
    const mockUrl = 'http://example.com/puppeteer';
    const mockPageUrl = 'http://example.com/puppeteer-final'; // After potential redirects
    
    mockPage.goto.mockResolvedValue(null); // Simulate successful navigation
    mockPage.evaluate.mockImplementation((evalFunc: () => any) => {
      // First evaluate call is for removing elements (mocked to do nothing here)
      // Second evaluate call is for extracting data
      if ((evalFunc.toString()).includes("document.querySelectorAll(selector).forEach(el => el.remove())")) {
        return Promise.resolve();
      }
      return Promise.resolve({
        textContent: 'Puppeteer main content with enough length to pass tests. Some more text. Adding even more text to ensure it reliably passes the minimum content length of 100 characters.',
        images: [
          { src: '/img1.jpg', alt: 'Puppeteer Image 1' },
          { src: 'https://othersite.com/img2.png', alt: 'Puppeteer Image 2' },
        ],
      });
    });
    mockPage.url.mockReturnValue(mockPageUrl);

    const result = await scrapeWithPuppeteer(mockUrl);

    expect(mockedPuppeteer.launch).toHaveBeenCalled();
    expect(mockBrowser.newPage).toHaveBeenCalled();
    expect(mockPage.goto).toHaveBeenCalledWith(mockUrl, expect.objectContaining({ waitUntil: 'networkidle0' }));
    expect(mockPage.evaluate).toHaveBeenCalledTimes(2); // One for removing, one for extracting
    expect(result.textContent).toBe('Puppeteer main content with enough length to pass tests. Some more text. Adding even more text to ensure it reliably passes the minimum content length of 100 characters.');
    expect(result.images).toEqual([
      { src: 'http://example.com/img1.jpg', alt: 'Puppeteer Image 1' }, // Assuming mockPageUrl is base for relative /img1.jpg
      { src: 'https://othersite.com/img2.png', alt: 'Puppeteer Image 2' },
    ]);
    expect(result.finalUrl).toBe(mockPageUrl);
    expect(mockBrowser.close).toHaveBeenCalled();
  });
  
  it('should correctly resolve relative image URLs using the page.url() as base', async () => {
    const mockUrl = 'http://example.com/puppeteer/page';
    const mockPageUrl = 'http://example.com/puppeteer/final/path/index.html';
    
    mockPage.goto.mockResolvedValue(null);
    mockPage.evaluate.mockImplementation((evalFunc: () => any) => {
      if ((evalFunc.toString()).includes("document.querySelectorAll(selector).forEach(el => el.remove())")) {
        return Promise.resolve();
      }
      return Promise.resolve({
        textContent: 'Puppeteer content long enough for this specific test case to pass validation. This additional text makes sure that we are well over the one hundred character limit.',
        images: [{ src: '../../images/relative.jpg', alt: 'Relative Puppeteer' }],
      });
    });
    mockPage.url.mockReturnValue(mockPageUrl);

    const result = await scrapeWithPuppeteer(mockUrl);
    expect(result.images).toEqual([
      { src: 'http://example.com/puppeteer/images/relative.jpg', alt: 'Relative Puppeteer' },
    ]);
    expect(result.finalUrl).toBe(mockPageUrl);
  });


  it('should throw an error if content length is less than MIN_CONTENT_LENGTH', async () => {
    const mockUrl = 'http://example.com/short-puppeteer';
    mockPage.goto.mockResolvedValue(null);
    mockPage.evaluate.mockImplementation((evalFunc: () => any) => {
      if ((evalFunc.toString()).includes("document.querySelectorAll(selector).forEach(el => el.remove())")) {
        return Promise.resolve();
      }
      return Promise.resolve({ textContent: 'Short', images: [] });
    });
    mockPage.url.mockReturnValue(mockUrl);

    await expect(scrapeWithPuppeteer(mockUrl)).rejects.toThrow(/Puppeteer extracted too little text/);
    expect(mockBrowser.close).toHaveBeenCalled(); // Ensure browser close is called even on error
  });

  it('should handle page.goto navigation errors', async () => {
    const mockUrl = 'http://example.com/goto-error';
    mockPage.goto.mockRejectedValue(new Error('Navigation failed'));

    await expect(scrapeWithPuppeteer(mockUrl)).rejects.toThrow(`Puppeteer failed for ${mockUrl}: Navigation failed`);
    expect(mockBrowser.close).toHaveBeenCalled();
  });
  
  it('should handle page.evaluate errors', async () => {
    const mockUrl = 'http://example.com/evaluate-error';
    mockPage.goto.mockResolvedValue(null);
    mockPage.evaluate.mockImplementation((evalFunc: () => any) => {
      if ((evalFunc.toString()).includes("document.querySelectorAll(selector).forEach(el => el.remove())")) {
        return Promise.resolve(); // First call (remove elements) succeeds
      }
      return Promise.reject(new Error('Evaluation script error')); // Second call (extract data) fails
    });
     mockPage.url.mockReturnValue(mockUrl);

    await expect(scrapeWithPuppeteer(mockUrl)).rejects.toThrow(`Puppeteer failed for ${mockUrl}: Evaluation script error`);
    expect(mockBrowser.close).toHaveBeenCalled();
  });
});
