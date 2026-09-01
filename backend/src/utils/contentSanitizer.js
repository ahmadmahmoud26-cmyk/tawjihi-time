function sanitizeContent(content, sectionType = 'text') {
  if (content === null || content === undefined) {
    return '';
  }

  let value = typeof content === 'string' ? content : String(content);

  if (!value) {
    return '';
  }

  if (sectionType === 'rich_text') {
    const allowedTags = ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span'];

    let sanitized = value
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/<object[\s\S]*?<\/object>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s+href\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, (match) => {
        const lower = match.toLowerCase();
        if (lower.includes('javascript:')) {
          return ' href="#"';
        }
        return match;
      })
      .replace(/\s+>/g, '>');

    sanitized = sanitized.replace(new RegExp(`<(?!/?(?:${allowedTags.join('|')})\\b)[^>]+>`, 'gi'), '');
    return sanitized;
  }

  return value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript\s*:/gi, '')
    .trim();
}

module.exports = { sanitizeContent };
