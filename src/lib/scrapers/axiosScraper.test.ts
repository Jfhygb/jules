import axios from 'axios';
import { scrapeWithAxios } from './axiosScraper';
import { JavaScriptRequiredError } from '../utils';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('scrapeWithAxios', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should scrape text and images correctly and return finalUrl', async () => {
    const mockUrl = 'http://example.com';
    const mockHtml = `
      <html>
        <head><title>Test Page</title></head>
        <body>
          <p>Hello World This is some substantial text to meet the minimum content length requirement for testing purposes.</p>
          <img src="/image1.jpg" alt="First Image">
          <img src="https://example.com/image2.png" alt="Second Image">
          <a href="anotherpage.html">Link to Another Page</a>
        </body>
      </html>
    `;
    mockedAxios.get.mockResolvedValue({
      data: mockHtml,
      headers: { 'content-type': 'text/html' },
      request: { res: { responseUrl: mockUrl } }, // Simulate final URL
    });

    const result = await scrapeWithAxios(mockUrl);

    expect(mockedAxios.get).toHaveBeenCalledWith(mockUrl, expect.any(Object));
    expect(result.textContent).toBe('Hello World This is some substantial text to meet the minimum content length requirement for testing purposes. Link to Another Page');
    expect(result.images).toEqual([
      { src: 'http://example.com/image1.jpg', alt: 'First Image' },
      { src: 'https://example.com/image2.png', alt: 'Second Image' },
    ]);
    expect(result.finalUrl).toBe(mockUrl);
  });

  it('should throw JavaScriptRequiredError if JS patterns are found and content is minimal', async () => {
    const mockUrl = 'http://example.com/js-required';
    const mockHtml = `
      <html>
        <body>
          <noscript>Please enable JavaScript to view this page.</noscript>
          <p>Content is minimal.</p> 
        </body>
      </html>
    `; // textContent.length will be small
    mockedAxios.get.mockResolvedValue({
      data: mockHtml,
      headers: { 'content-type': 'text/html' },
      request: { res: { responseUrl: mockUrl } },
    });

    await expect(scrapeWithAxios(mockUrl)).rejects.toThrow(JavaScriptRequiredError);
  });

  it('should NOT throw JavaScriptRequiredError if JS patterns are found but content is substantial', async () => {
    const mockUrl = 'http://example.com/js-but-content';
    const mockHtml = `
      <html>
        <body>
          <noscript>Please enable JavaScript.</noscript>
          <p>${'Substantial content. '.repeat(50)}</p> 
        </body>
      </html>
    `;
    mockedAxios.get.mockResolvedValue({
      data: mockHtml,
      headers: { 'content-type': 'text/html' },
      request: { res: { responseUrl: mockUrl } },
    });

    const result = await scrapeWithAxios(mockUrl);
    expect(result.textContent).toContain('Substantial content.');
  });


  it('should throw an error if content length is less than MIN_CONTENT_LENGTH', async () => {
    const mockUrl = 'http://example.com/short';
    const mockHtml = '<html><body><p>Hi</p></body></html>'; // Very short content
    mockedAxios.get.mockResolvedValue({
      data: mockHtml,
      headers: { 'content-type': 'text/html' },
      request: { res: { responseUrl: mockUrl } },
    });

    await expect(scrapeWithAxios(mockUrl)).rejects.toThrow(/Axios extracted too little text/);
  });

  it('should throw an error for non-html content type', async () => {
    const mockUrl = 'http://example.com/file.json';
    mockedAxios.get.mockResolvedValue({
      data: '{ "data": "json" }',
      headers: { 'content-type': 'application/json' },
      request: { res: { responseUrl: mockUrl } },
    });

    await expect(scrapeWithAxios(mockUrl)).rejects.toThrow(/Invalid content type/);
  });

  it('should handle network errors from axios', async () => {
    const mockUrl = 'http://example.com/network-error';
    mockedAxios.get.mockRejectedValue(new Error('Network error'));

    // Adjusted to expect the simpler error message for generic errors
    await expect(scrapeWithAxios(mockUrl)).rejects.toThrow(`Axios failed for ${mockUrl}: Network error`);
  });
  
  it('should use original URL as finalUrl if responseUrl is not available', async () => {
    const mockUrl = 'http://example.com/no-response-url';
    const mockHtml = `<html><body><p>Sufficient content here to pass the minimum length check.</p><img src="img.png" alt="alt"></body></html>`;
    mockedAxios.get.mockResolvedValue({
      data: mockHtml,
      headers: { 'content-type': 'text/html' },
      // request or request.res or request.res.responseUrl is missing
      request: {}, 
    });

    const result = await scrapeWithAxios(mockUrl);
    expect(result.finalUrl).toBe(mockUrl);
    expect(result.textContent).toBe('Sufficient content here to pass the minimum length check.');
    expect(result.images).toEqual([{ src: 'http://example.com/img.png', alt: 'alt' }]);
  });

  it('should correctly resolve relative image URLs', async () => {
    const mockUrl = 'http://example.com/path/page.html';
    // Increased length of the paragraph text
    const mockHtml = `<html><body><p>This is some longer text to ensure that the content length requirement is definitely met for this test case.</p><img src="../images/pic.jpg" alt="Relative Test"></body></html>`;
    mockedAxios.get.mockResolvedValue({
      data: mockHtml,
      headers: { 'content-type': 'text/html' },
      request: { res: { responseUrl: mockUrl } },
    });

    const result = await scrapeWithAxios(mockUrl);
    expect(result.images).toEqual([
      { src: 'http://example.com/images/pic.jpg', alt: 'Relative Test' },
    ]);
  });
});
