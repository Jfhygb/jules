"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [scrapedContent, setScrapedContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScrape = async () => {
    setIsLoading(true);
    setError(null);
    setScrapedContent(""); // Clear previous content

    if (!url) {
      setError("Please enter a URL.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Use error from API response if available, otherwise a generic one
        setError(data.error || `Error: ${response.status} ${response.statusText}`);
      } else {
        // Handle cases where API might return a message instead of scrapedText (e.g., Puppeteer pending)
        if (data.scrapedText) {
          setScrapedContent(data.scrapedText);
        } else if (data.message) {
          // Display messages from API (like "Both Cheerio and Puppeteer yielded minimal content.")
          setScrapedContent(data.message + (data.cheerioAttempt ? `\nCheerio: ${data.cheerioAttempt}` : '') + (data.puppeteerAttempt ? `\nPuppeteer: ${data.puppeteerAttempt}` : ''));
        } else {
            setError("Received an unexpected response from the server.");
        }
      }
    } catch (err: any) {
      console.error("Scraping request failed:", err);
      setError(err.message || "An unexpected error occurred during the request.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto w-full px-4">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-light-blue-500 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div>
              <h1 className="text-2xl font-semibold text-center text-gray-800">Jina Scraper</h1>
            </div>
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
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
                <div className="pt-2 flex justify-center">
                  <button
                    onClick={handleScrape}
                    className={`bg-cyan-500 hover:bg-cyan-600 px-6 py-2 text-white rounded-md font-semibold shadow-md transition duration-200 ease-in-out ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                    disabled={isLoading}
                  >
                    {isLoading ? "Scraping..." : "Scrape"}
                  </button>
                </div>
              </div>

              {error && (
                <div className="pt-4 text-red-500 text-sm text-center">
                  <p>Error: {error}</p>
                </div>
              )}

              <div className="pt-6 text-base leading-6 font-bold sm:text-lg sm:leading-7">
                <p className="text-center text-gray-600">Scraped Content Preview:</p>
                <div
                  id="scraped-content-preview"
                  data-testid="scraped-content-preview"
                  className="mt-4 p-4 h-64 border border-gray-300 rounded-md bg-gray-50 overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap"
                >
                  {scrapedContent || (!isLoading && !error && "Scraped content will appear here...") || (isLoading && "Loading content...")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
