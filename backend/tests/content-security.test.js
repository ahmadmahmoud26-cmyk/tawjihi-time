const { sanitizeContent } = require('../src/utils/contentSanitizer');

describe('content sanitizer', () => {
  test('removes script tags and unsafe HTML from plain content', () => {
    expect(sanitizeContent('<script>alert(1)</script><p>Hello</p>')).toBe('Hello');
  });

  test('allows safe rich text tags but strips script execution attributes', () => {
    expect(sanitizeContent('<p onclick="alert(1)"><strong>Hi</strong></p>', 'rich_text')).toBe('<p><strong>Hi</strong></p>');
  });
});
