import axios, { AxiosResponse } from 'axios';
import { cleanText } from '../utils';

const MIN_CONTENT_LENGTH = 50; // Minimum characters to consider a successful scrape
const AXIOS_TIMEOUT = 15000; // 15 seconds

export async function scrapeWithAxios(url: string): Promise<string> {
  console.log(`Attempting Axios scrape for: ${url}`);
  try {
    const response: AxiosResponse<string> = await axios.get(url, {
      timeout: AXIOS_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8' // Request HTML-like content
      },
      // Validate status to ensure we only process successful responses,
      // otherwise Axios will throw an error for non-2xx codes which is handled by the catch block.
      validateStatus: function (status) {
        return status >= 200 && status < 300; 
      }
    });

    const contentType = response.headers['content-type'];
    if (!contentType || !contentType.toLowerCase().includes('text/html')) {
      // Even if status is 200, if it's not HTML, we can't process it as such.
      throw new Error(`Invalid content type: ${contentType}. Expected text/html.`);
    }

    const htmlString = response.data;

    // Basic text extraction: strip all HTML tags. This is naive.
    // A slightly more refined approach might be to first extract body content, but keeping it simple as requested.
    let extractedText = htmlString.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ''); // Remove style tags and content
    extractedText = extractedText.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ''); // Remove script tags and content
    extractedText = extractedText.replace(/<[^>]+>/g, ''); // Remove all other HTML tags

    const cleanedExtractedText = cleanText(extractedText);

    if (cleanedExtractedText.length < MIN_CONTENT_LENGTH) {
      throw new Error(`Axios extracted too little text (${cleanedExtractedText.length} chars) after basic HTML stripping.`);
    }
    
    console.log(`Axios scrape successful for: ${url}. Length: ${cleanedExtractedText.length}`);
    return cleanedExtractedText;

  } catch (error: any) {
    let errorMessage = `Axios failed for ${url}: `;
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorMessage += `Server responded with status ${error.response.status} - ${error.response.statusText}. `;
        if (error.response.data && typeof error.response.data === 'string' && error.response.data.length < 500) {
          // Include response data if it's short and might be informative (e.g., an error message from server)
          // errorMessage += `Response data: ${error.response.data}`;
        }
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage += 'No response received from server. Check network or URL.';
      } else {
        // Something happened in setting up the request that triggered an Error
        errorMessage += `Request setup error - ${error.message}`;
      }
       if (error.code === 'ECONNABORTED') {
        errorMessage += 'Request timed out.';
      }
    } else {
      // Not an Axios error, could be one of our custom errors (e.g. content type, content length)
      errorMessage += error.message;
    }
    console.error(errorMessage);
    throw new Error(errorMessage); // Re-throw with a comprehensive message
  }
}
