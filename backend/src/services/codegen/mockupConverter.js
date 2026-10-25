/**
 * Mockup HTML to React JSX Converter
 * Transforms Stitch HTML mockups into interactive, compilable React components
 */

function convertHtmlToJsx(htmlContent, componentName, route, entityName = '') {
  if (!htmlContent) return '';

  // 1. Extract main content or body
  let content = '';
  const mainMatch = htmlContent.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    const mainOpenMatch = htmlContent.match(/<main[^>]*>/i);
    const mainOpen = mainOpenMatch ? mainOpenMatch[0] : '<main>';
    content = `${mainOpen}${mainMatch[1]}</main>`;
  } else {
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    content = bodyMatch ? bodyMatch[1] : htmlContent;
  }

  // 2. Remove script tags and comments
  content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  content = content.replace(/<!--[\s\S]*?-->/g, '');

  // 3. Convert class to className and for to htmlFor
  content = content.replace(/\bclass="/g, 'className="');
  content = content.replace(/\bclass='/g, "className='");
  content = content.replace(/\bfor="/g, 'htmlFor="');
  content = content.replace(/\bfor='/g, "htmlFor='");

  // 4. HTML to JSX common attribute conversions
  content = content.replace(/\btabindex=/gi, 'tabIndex=');
  content = content.replace(/\bautocomplete=/gi, 'autoComplete=');
  content = content.replace(/\bautofocus=/gi, 'autoFocus=');
  content = content.replace(/\breadonly=/gi, 'readOnly=');
  content = content.replace(/\bmaxlength=/gi, 'maxLength=');
  content = content.replace(/\bminlength=/gi, 'minLength=');
  content = content.replace(/\bcolspan=/gi, 'colSpan=');
  content = content.replace(/\browspan=/gi, 'rowSpan=');

  // 5. Convert SVG attributes to camelCase
  content = content.replace(/\bstroke-width=/gi, 'strokeWidth=');
  content = content.replace(/\bstroke-linecap=/gi, 'strokeLinecap=');
  content = content.replace(/\bstroke-linejoin=/gi, 'strokeLinejoin=');
  content = content.replace(/\bstroke-dasharray=/gi, 'strokeDasharray=');
  content = content.replace(/\bstroke-dashoffset=/gi, 'strokeDashoffset=');
  content = content.replace(/\bfill-rule=/gi, 'fillRule=');
  content = content.replace(/\bclip-rule=/gi, 'clipRule=');
  content = content.replace(/\bclip-path=/gi, 'clipPath=');
  content = content.replace(/\bxmlns:xlink=/gi, 'xmlnsXlink=');
  content = content.replace(/\bxlink:href=/gi, 'xlinkHref=');

  // 6. Autoclose void elements: <input>, <img>, <br>, <hr>
  const voidTags = ['input', 'img', 'br', 'hr', 'source', 'link', 'meta'];
  for (const tag of voidTags) {
    const regex = new RegExp(`<(${tag})\\b([^>]*?)(?<!/)>`, 'gi');
    content = content.replace(regex, '<$1$2 />');
  }

  // 7. Convert inline styles: style="display: flex; gap: 8px;" -> style={{ display: 'flex', gap: '8px' }}
  content = content.replace(/\bstyle="([^"]*)"/g, (match, styleStr) => {
    try {
      const styles = {};
      styleStr.split(';').forEach(rule => {
        const [prop, val] = rule.split(':').map(s => s && s.trim());
        if (prop && val) {
          const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          styles[camelProp] = val;
        }
      });
      return `style={${JSON.stringify(styles)}}`;
    } catch {
      return '';
    }
  });

  return content;
}

module.exports = {
  convertHtmlToJsx
};
