import playwright from 'playwright';
import { scrapeWithPlaywright } from './playwrightScraper';

// Mock playwright
jest.mock('playwright');

const mockedPlaywright = playwright as jest.Mocked<typeof playwright>;

describe('scrapeWithPlaywright', () => {
  let mockPage: any;
  let mockContext: any;
  let mockBrowser: any;

  beforeEach(() => {
    // Reset mocks for each test
    mockPage = {
      goto: jest.fn(),
      evaluate: jest.fn(),
      url: jest.fn(),
    };
    mockContext = {
      newPage: jest.fn().mockResolvedValue(mockPage),
    };
    mockBrowser = {
      newContext: jest.fn().mockResolvedValue(mockContext),
      close: jest.fn(),
    };
    // Since playwright.chromium.launch is the typical usage
    mockedPlaywright.chromium = {
      launch: jest.fn().mockResolvedValue(mockBrowser),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should scrape text and images correctly and return finalUrl', async () => {
    const mockUrl = 'http://example.com/playwright';
    const mockPageUrl = 'http://example.com/playwright-final';
    
    mockPage.goto.mockResolvedValue(null);
    mockPage.evaluate.mockImplementation((evalFunc: () => any) => {
      if ((evalFunc.toString()).includes("document.querySelectorAll(selector).forEach(el => el.remove())")) {
        return Promise.resolve();
      }
      return Promise.resolve({
        textContent: 'Playwright main content with enough length to pass tests. This is very long text indeed, ensuring it is over one hundred characters for sure.',
        images: [
          { src: '/assets/logo.svg', alt: 'Playwright Logo' },
          { src: 'https://pics.example.com/photo.jpg', alt: 'Playwright Photo' },
        ],
      });
    });
    mockPage.url.mockReturnValue(mockPageUrl);

    const result = await scrapeWithPlaywright(mockUrl);

    expect(mockedPlaywright.chromium.launch).toHaveBeenCalled();
    expect(mockBrowser.newContext).toHaveBeenCalled();
    expect(mockContext.newPage).toHaveBeenCalled();
    expect(mockPage.goto).toHaveBeenCalledWith(mockUrl, expect.objectContaining({ waitUntil: 'networkidle' }));
    expect(mockPage.evaluate).toHaveBeenCalledTimes(2);
    expect(result.textContent).toBe('Playwright main content with enough length to pass tests. This is very long text indeed, ensuring it is over one hundred characters for sure.');
    expect(result.images).toEqual([
      { src: 'http://example.com/assets/logo.svg', alt: 'Playwright Logo' }, // Assuming mockPageUrl as base
      { src: 'https://pics.example.com/photo.jpg', alt: 'Playwright Photo' },
    ]);
    expect(result.finalUrl).toBe(mockPageUrl);
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('should correctly resolve relative image URLs using the page.url() as base', async () => {
    const mockUrl = 'http://example.com/playwright/page';
    const mockPageUrl = 'http://example.com/playwright/final/path/index.html';
    
    mockPage.goto.mockResolvedValue(null);
    mockPage.evaluate.mockImplementation((evalFunc: () => any) => {
      if ((evalFunc.toString()).includes("document.querySelectorAll(selector).forEach(el => el.remove())")) {
        return Promise.resolve();
      }
      return Promise.resolve({
        textContent: 'Playwright content, long enough for this specific test case to pass validation. This additional text makes sure that we are well over the one hundred character limit for sure.',
        images: [{ src: '../../assets/image.gif', alt: 'Relative Playwright' }],
      });
    });
    mockPage.url.mockReturnValue(mockPageUrl);

    const result = await scrapeWithPlaywright(mockUrl);
    expect(result.images).toEqual([
      { src: 'http://example.com/playwright/assets/image.gif', alt: 'Relative Playwright' },
    ]);
    expect(result.finalUrl).toBe(mockPageUrl);
  });

  it('should throw an error if content length is less than MIN_CONTENT_LENGTH', async () => {
    const mockUrl = 'http://example.com/short-playwright';
    mockPage.goto.mockResolvedValue(null);
    mockPage.evaluate.mockImplementation((evalFunc: () => any) => {
      if ((evalFunc.toString()).includes("document.querySelectorAll(selector).forEach(el => el.remove())")) {
        return Promise.resolve();
      }
      return Promise.resolve({ textContent: 'Tiny', images: [] });
    });
    mockPage.url.mockReturnValue(mockUrl);

    await expect(scrapeWithPlaywright(mockUrl)).rejects.toThrow(/Playwright extracted too little text/);
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('should handle page.goto navigation errors', async () => {
    const mockUrl = 'http://example.com/playwright-goto-error';
    mockPage.goto.mockRejectedValue(new Error('Playwright Nav Failed'));

    await expect(scrapeWithPlaywright(mockUrl)).rejects.toThrow(`Playwright failed for ${mockUrl}: Playwright Nav Failed`);
    expect(mockBrowser.close).toHaveBeenCalled();
  });
  
  it('should handle page.evaluate errors', async () => {
    const mockUrl = 'http://example.com/playwright-eval-error';
    mockPage.goto.mockResolvedValue(null);
    mockPage.evaluate.mockImplementation((evalFunc: () => any) => {
       if ((evalFunc.toString()).includes("document.querySelectorAll(selector).forEach(el => el.remove())")) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('Playwright Eval Error'));
    });
    mockPage.url.mockReturnValue(mockUrl);

    await expect(scrapeWithPlaywright(mockUrl)).rejects.toThrow(`Playwright failed for ${mockUrl}: Playwright Eval Error`);
    expect(mockBrowser.close).toHaveBeenCalled();
  });
});
