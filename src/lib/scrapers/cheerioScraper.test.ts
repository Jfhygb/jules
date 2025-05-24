import { scrapeWithCheerio } from './cheerioScraper';
import { JavaScriptRequiredError } from '../utils';

// Mock the global fetch function
global.fetch = jest.fn();

describe('scrapeWithCheerio', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should scrape text and images correctly and return finalUrl', async () => {
    const mockUrl = 'http://example.com/cheerio';
    const mockFinalUrl = 'http://example.com/cheerio-final'; // Simulate a redirect
    const mockHtml = `
      <html>
        <head><title>Cheerio Test</title></head>
        <body>
          <main>
            <p>Main content here, long enough to pass the minimum length check. This text is added to make sure it exceeds the threshold for testing purposes.</p>
            <img src="/image.png" alt="Cheerio Image">
            <img src="https://external.com/another.jpg" alt="External Image">
          </main>
          <script>console.log("test script")</script>
          <style>.p {color: red}</style>
        </body>
      </html>
    `;

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
      url: mockFinalUrl, // This is how fetch provides the final URL
      status: 200,
      statusText: 'OK'
    });

    const result = await scrapeWithCheerio(mockUrl);

    expect(fetch).toHaveBeenCalledWith(mockUrl);
    expect(result.textContent).toBe('Main content here, long enough to pass the minimum length check. This text is added to make sure it exceeds the threshold for testing purposes.');
    expect(result.images).toEqual([
      { src: 'http://example.com/image.png', alt: 'Cheerio Image' },
      { src: 'https://external.com/another.jpg', alt: 'External Image' },
    ]);
    expect(result.finalUrl).toBe(mockFinalUrl);
  });

  it('should throw JavaScriptRequiredError if JS patterns are found and content is minimal', async () => {
    const mockUrl = 'http://example.com/js-req-cheerio';
    const mockHtml = `
      <html>
        <body>
          <noscript>This page requires JavaScript to function properly.</noscript>
          <p>Very short.</p>
        </body>
      </html>
    `;
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
      url: mockUrl,
      status: 200,
      statusText: 'OK'
    });

    await expect(scrapeWithCheerio(mockUrl)).rejects.toThrow(JavaScriptRequiredError);
    expect(fetch).toHaveBeenCalledWith(mockUrl);
  });
  
  it('should NOT throw JavaScriptRequiredError if JS patterns are found but content is substantial', async () => {
    const mockUrl = 'http://example.com/js-but-long-cheerio';
    const mockHtml = `
      <html>
        <body>
          <noscript>Enable JavaScript please!</noscript>
          <p>${"This is substantial content that should pass the length check. ".repeat(20)}</p>
        </body>
      </html>
    `;
     (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
      url: mockUrl,
      status: 200,
      statusText: 'OK'
    });

    const result = await scrapeWithCheerio(mockUrl);
    expect(result.textContent).toContain("This is substantial content");
    expect(fetch).toHaveBeenCalledWith(mockUrl);
  });

  it('should throw an error if content length is less than MIN_CONTENT_LENGTH', async () => {
    const mockUrl = 'http://example.com/short-cheerio';
    const mockHtml = '<html><body><p>Tiny</p></body></html>';
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
      url: mockUrl,
      status: 200,
      statusText: 'OK'
    });

    await expect(scrapeWithCheerio(mockUrl)).rejects.toThrow(/Cheerio extracted too little text/);
  });

  it('should throw an error if fetch response is not ok', async () => {
    const mockUrl = 'http://example.com/notfound-cheerio';
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      url: mockUrl,
    });

    await expect(scrapeWithCheerio(mockUrl)).rejects.toThrow(/Failed to fetch URL with Cheerio: 404 Not Found/);
  });

  it('should handle network errors from fetch', async () => {
    const mockUrl = 'http://example.com/network-error-cheerio';
    (fetch as jest.Mock).mockRejectedValue(new Error('Network connection failed'));

    await expect(scrapeWithCheerio(mockUrl)).rejects.toThrow(`Cheerio failed for ${mockUrl}: Network connection failed`);
  });
  
  it('should correctly resolve relative image URLs using the finalUrl', async () => {
    const mockInitialUrl = 'http://example.com/initial';
    const mockFinalUrl = 'http://example.com/final/path/page.html';
    const mockHtml = `<html><body><p>Some text to ensure content length is met, this should be long enough. Adding more text just in case it was borderline for the test.</p><img src="../images/pic.jpg" alt="Relative Test"></body></html>`;
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
      url: mockFinalUrl, // fetch response.url is the final URL
      status: 200,
      statusText: 'OK'
    });

    const result = await scrapeWithCheerio(mockInitialUrl);
    expect(result.images).toEqual([
      // Corrected expected URL: ../images/pic.jpg relative to http://example.com/final/path/page.html
      // should resolve to http://example.com/final/images/pic.jpg
      { src: 'http://example.com/final/images/pic.jpg', alt: 'Relative Test' },
    ]);
    expect(result.finalUrl).toBe(mockFinalUrl);
  });
});
