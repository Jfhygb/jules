import { cleanText, JavaScriptRequiredError } from './utils';

describe('Utils', () => {
  describe('cleanText', () => {
    it('should return an empty string if input is empty, null, or undefined', () => {
      expect(cleanText('')).toBe('');
      // @ts-ignore
      expect(cleanText(null)).toBe('');
      // @ts-ignore
      expect(cleanText(undefined)).toBe('');
    });

    it('should remove script tags and their content', () => {
      const html = '<p>Hello</p><script>alert("world");</script><div>Test</div>';
      expect(cleanText(html)).toBe('Hello Test');
    });

    it('should remove style tags and their content', () => {
      const html = '<style>.body { color: red; }</style><span>Styled</span>';
      expect(cleanText(html)).toBe('Styled');
    });

    it('should treat noscript tags like other HTML tags (remove tags, keep content, add spaces)', () => {
      const html = '<noscript>JS is off</noscript><p>Content</p>';
      expect(cleanText(html)).toBe('JS is off Content'); // Corrected expectation
    });

    it('should remove all HTML tags', () => {
      const html = '<h1>Title</h1><p>Paragraph <em>emphasis</em></p><br/><div>Another</div>';
      expect(cleanText(html)).toBe('Title Paragraph emphasis Another');
    });

    it('should replace multiple newlines and spaces with a single space and trim', () => {
      const text = '  Extra   \n\n spaces \t and \r\n newlines  ';
      expect(cleanText(text)).toBe('Extra spaces and newlines');
    });

    it('should handle mixed content correctly', () => {
      const html = `
        <div>
          <h2>Important <style>h2 {font-weight: bold;}</style>Info</h2>
          <p>This is a test.
            <script>
              console.log("test");
            </script>
          </p>
          <noscript>Enable JavaScript!</noscript>
          And some   more text.
        </div>
      `;
      // Corrected: "Enable JavaScript!" should be present as its <noscript> tag is replaced by spaces
      expect(cleanText(html)).toBe('Important Info This is a test. Enable JavaScript! And some more text.'); 
    });

    it('should handle self-closing tags', () => {
        const html = '<p>Text with a break<br/>and an image<img src="test.jpg" alt="test"/>.</p>';
        expect(cleanText(html)).toBe('Text with a break and an image .');
    });
  });

  describe('JavaScriptRequiredError', () => {
    it('should create an error with the correct name and message', () => {
      const message = 'JavaScript is essential for this page.';
      const error = new JavaScriptRequiredError(message);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(JavaScriptRequiredError);
      expect(error.name).toBe('JavaScriptRequiredError');
      expect(error.message).toBe(message);
    });
  });
});
