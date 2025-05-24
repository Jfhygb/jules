/**
 * @file src/lib/utils.ts
 * @description Utility functions and custom error classes for the Jina Scraper application.
 */

/**
 * @function cleanText
 * @description Cleans a string of text by removing HTML tags, script/style/noscript content,
 * and normalizing whitespace.
 * @param {string} text - The input string to clean.
 * @returns {string} The cleaned string. Returns an empty string if the input is falsy.
 */
export const cleanText = (text: string): string => {
  if (!text) return ''; // Return empty if input is null, undefined, or empty

  let cleanedText = text;

  // Remove <script> and <style> tags and their entire content
  // These are removed first as they can contain arbitrary characters that might interfere with other regex
  cleanedText = cleanedText.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
  cleanedText = cleanedText.replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '');
  
  // Replace HTML tags with a space to ensure separation of text content
  // This helps prevent words from different tags from merging, e.g. <p>Hello</p><p>World</p> -> Hello World
  // It handles block tags, inline tags, and self-closing tags appropriately by adding a space.
  cleanedText = cleanedText.replace(/<\/?[^>]+(>|$)/g, " "); 
  
  // Replace multiple newlines, tabs, and spaces (including those introduced by tag removal) with a single space
  cleanedText = cleanedText.replace(/\s\s+/g, ' ').trim();
  
  return cleanedText;
};

/**
 * @class JavaScriptRequiredError
 * @description Custom error class to indicate that a page likely requires JavaScript
 * to render its primary content, and a non-JS scraper (like Axios or Cheerio)
 * was unable to retrieve meaningful information.
 */
export class JavaScriptRequiredError extends Error {
  /**
   * @constructor
   * @param {string} message - The error message.
   */
  constructor(message: string) {
    super(message);
    this.name = "JavaScriptRequiredError"; // Set the error name for identification
  }
}
