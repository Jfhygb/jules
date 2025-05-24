/**
 * @file src/app/page.tsx
 * @description Frontend component for the Jina Scraper application.
 * This component provides a user interface for entering a URL, selecting scraping options,
 * initiating a scrape request to the backend API, and displaying the results (including
 * scraped text content as Markdown, the scraping strategy used, and the final URL scraped).
 */
"use client"; // Directive for Next.js to treat this as a Client Component

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown"; // Component to render Markdown content

/**
 * @function Home
 * @description Main functional component for the scraper's home page.
 * @returns {JSX.Element} The rendered React component.
 */
export default function Home() {
  // --- State Variables ---
  const [url, setUrl] = useState<string>(""); // URL to be scraped
  const [scraperAgent, setScraperAgent] = useState<string>(""); // Selected scraper agent (e.g., "axios", "puppeteer")
  const [crawlDepth, setCrawlDepth] = useState<number>(0); // Crawl depth for scraping (currently not implemented in backend logic)
  const [searchDepth, setSearchDepth] = useState<number>(0); // Search depth for scraping (currently not implemented in backend logic)
  
  const [scrapedContent, setScrapedContent] = useState<string>(""); // Scraped content (Markdown formatted)
  const [isLoading, setIsLoading] = useState<boolean>(false); // Loading state for the scrape operation
  const [error, setError] = useState<string | null>(null); // Error messages from the scrape operation
  
  const [usedStrategy, setUsedStrategy] = useState<string | null>(null); // Scraping strategy reported by the backend
  const [finalScrapedUrl, setFinalScrapedUrl] = useState<string | null>(null); // Final URL after any redirects, reported by backend

  /**
   * @effect useEffect
   * @description Handles URL pre-filling from path or query parameters on component mount.
   * It checks for `/?sq/URL_HERE` in the path or `?sq=URL_HERE` in query parameters.
   */
  useEffect(() => {
    const path = window.location.pathname;
    const search = window.location.search; 
    let urlFromParam = "";

    const sqPathKey = "/?sq/";
    const sqPathIndex = path.indexOf(sqPathKey);

    // Check path first
    if (sqPathIndex !== -1) {
      urlFromParam = path.substring(sqPathIndex + sqPathKey.length);
    } else {
      // Fallback to check query parameter
      const queryParams = new URLSearchParams(search);
      const sqQueryParam = queryParams.get("sq");
      if (sqQueryParam) {
        urlFromParam = sqQueryParam;
      }
    }
    
    if (urlFromParam) {
      try {
        let decodedUrl = decodeURIComponent(urlFromParam);
        // Prepend https:// if no protocol is present and it looks like a domain
        if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://') && decodedUrl.includes('.')) {
            decodedUrl = `https://${decodedUrl}`;
        }
        setUrl(decodedUrl);
      } catch (e) {
        console.error("Error decoding URL from param:", e);
        setError("Invalid URL provided in the path/query parameter.");
      }
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  /**
   * @function handleScrape
   * @description Handles the form submission to initiate a scraping request.
   * It constructs the request body and sends it to the backend API.
   * Updates state based on the API response (content, errors, strategy, final URL).
   */
  const handleScrape = async () => {
    setIsLoading(true);
    setError(null);
    setScrapedContent(""); 
    setUsedStrategy(null); 
    setFinalScrapedUrl(null); 

    if (!url) {
      setError("Please enter a URL.");
      setIsLoading(false);
      return;
    }

    // Construct the request body
    const requestBody: any = {
      url,
      crawlDepth, // Note: crawlDepth and searchDepth are sent but not yet used by the backend
      searchDepth,
    };

    // Only include scraperAgent if a specific agent (not "Auto/Default") is selected
    if (scraperAgent && scraperAgent !== "auto" && scraperAgent !== "") { 
      requestBody.scraperAgent = scraperAgent;
    }
    
    try {
      // Make the API call
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json(); // Parse the JSON response

      if (!response.ok) {
        // Handle API errors
        setError(data.error || `Error: ${response.status} ${response.statusText}`);
        setScrapedContent(""); 
        setUsedStrategy(null);
        setFinalScrapedUrl(null);
      } else {
        // Handle successful response
        if (data.scrapedText) {
          setScrapedContent(data.scrapedText);
          setUsedStrategy(data.strategy || null);
          setFinalScrapedUrl(data.finalUrl || null);
        } else if (data.message) { 
          // Handle cases where API returns a message (e.g., informational)
          setScrapedContent(data.message); 
          setError(data.message); // Display message as an error or info
          setUsedStrategy(data.strategy || null);
          setFinalScrapedUrl(data.finalUrl || null);
        } else {
          // Handle unexpected successful response format
            setError("Received an unexpected response from the server.");
            setScrapedContent("");
            setUsedStrategy(null);
            setFinalScrapedUrl(null);
        }
      }
    } catch (err: any) {
      // Handle network or other client-side errors during fetch
      console.error("Scraping request failed:", err);
      setScrapedContent("");
      setUsedStrategy(null);
      setFinalScrapedUrl(null);
      setError(err.message || "An unexpected error occurred during the request.");
    } finally {
      setIsLoading(false); // Reset loading state
    }
  };

  // --- JSX for Rendering the Component ---
  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto w-full px-4">
          <div className="max-w-md mx-auto"> {/* Constrains width for larger screens */}
            <div>
              <h1 className="text-2xl font-semibold text-center text-gray-800">Jina Scraper</h1>
            </div>
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                {/* URL Input Field */}
                <div className="flex flex-col">
                  <label htmlFor="urlInput" className="pb-2 text-sm font-semibold text-gray-600">
                    Enter URL to Scrape
                  </label>
                  <input
                    id="urlInput"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="px-4 py-2 border focus:ring-cyan-500 focus:border-cyan-500 w-full sm:text-sm border-gray-300 rounded-md focus:outline-none text-gray-600"
                    disabled={isLoading}
                  />
                </div>

                {/* Scraper Agent, Crawl Depth, Search Depth Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="scraperAgentSelect" className="pb-1 text-sm font-semibold text-gray-600 block">
                      Scraper Agent
                    </label>
                    <select
                      id="scraperAgentSelect"
                      value={scraperAgent}
                      onChange={(e) => setScraperAgent(e.target.value)}
                      className="px-3 py-2 border focus:ring-cyan-500 focus:border-cyan-500 w-full sm:text-sm border-gray-300 rounded-md focus:outline-none text-gray-600"
                      disabled={isLoading}
                    >
                      <option value="">Auto/Default</option>
                      <option value="axios">Axios</option>
                      <option value="cheerio">Cheerio</option>
                      <option value="puppeteer">Puppeteer</option>
                      <option value="playwright">Playwright</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="crawlDepthInput" className="pb-1 text-sm font-semibold text-gray-600 block">
                      Crawl Depth
                    </label>
                    <input
                      id="crawlDepthInput"
                      type="number"
                      value={crawlDepth}
                      onChange={(e) => setCrawlDepth(Math.max(0, parseInt(e.target.value, 10)))}
                      min="0"
                      className="px-3 py-2 border focus:ring-cyan-500 focus:border-cyan-500 w-full sm:text-sm border-gray-300 rounded-md focus:outline-none text-gray-600"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label htmlFor="searchDepthInput" className="pb-1 text-sm font-semibold text-gray-600 block">
                      Search Depth
                    </label>
                    <input
                      id="searchDepthInput"
                      type="number"
                      value={searchDepth}
                      onChange={(e) => setSearchDepth(Math.max(0, parseInt(e.target.value, 10)))}
                      min="0"
                      className="px-3 py-2 border focus:ring-cyan-500 focus:border-cyan-500 w-full sm:text-sm border-gray-300 rounded-md focus:outline-none text-gray-600"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Scrape Button */}
                <div className="pt-4 flex justify-center">
                  <button
                    onClick={handleScrape}
                    className={`bg-cyan-500 hover:bg-cyan-600 px-6 py-2 text-white rounded-md font-semibold shadow-md transition duration-200 ease-in-out ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                    disabled={isLoading}
                  >
                    {isLoading ? "Scraping..." : "Scrape"}
                  </button>
                </div>
              </div>

              {/* Error Display Area */}
              {error && (
                <div className="pt-4 text-red-500 text-sm text-center">
                  <p>Error: {error}</p>
                </div>
              )}

              {/* Scraped Content Display Area */}
              <div className="pt-6 text-base leading-6 font-bold sm:text-lg sm:leading-7">
                <p className="text-center text-gray-600">Scraped Content Preview:</p>
                <div
                  id="scraped-content-preview"
                  data-testid="scraped-content-preview"
                  // TailwindCSS `prose` classes for basic Markdown styling
                  className="mt-4 p-4 h-96 border border-gray-300 rounded-md bg-gray-50 overflow-y-auto text-sm text-gray-700 prose prose-sm max-w-none"
                >
                  {isLoading && <p>Loading content...</p>}
                  {!isLoading && error && <p className="text-red-500">An error occurred. Please check the error message above.</p>}
                  {!isLoading && !error && !scrapedContent && <p>Scraped content will appear here...</p>}
                  {scrapedContent && <ReactMarkdown>{scrapedContent}</ReactMarkdown>}
                </div>
                {/* Display Strategy and Final URL */}
                {!isLoading && (usedStrategy || finalScrapedUrl) && (
                  <div className="pt-4 text-xs text-gray-500 text-center space-y-1">
                    {usedStrategy && (
                      <p>Strategy: <span className="font-semibold">{usedStrategy}</span></p>
                    )}
                    {/* Only show Final URL if it's different from the input URL and available */}
                    {finalScrapedUrl && url !== finalScrapedUrl && (
                       <p>Final URL: <span className="font-semibold">{finalScrapedUrl}</span></p>
                    )}
                  </div>
                )}
              </div>
            </div>
          
        </div>
      </div>
    </div>
  );
}
