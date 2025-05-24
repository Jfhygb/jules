// Helper function to clean text
export const cleanText = (text: string): string => {
  if (!text) return '';
  // Remove <script>, <style>, <noscript> tags and their content
  let cleanedText = text.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
  cleanedText = cleanedText.replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '');
  cleanedText = cleanedText.replace(/<noscript[^>]*>([\S\s]*?)<\/noscript>/gmi, '');
  // Remove HTML tags
  cleanedText = cleanedText.replace(/<\/?[^>]+(>|$)/g, "");
  // Replace multiple newlines and spaces with a single space
  cleanedText = cleanedText.replace(/\s\s+/g, ' ').trim();
  return cleanedText;
};
