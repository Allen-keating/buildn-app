export const SELECTOR_SCRIPT = `
(function() {
  let enabled = false;
  let highlightEl = null;

  window.addEventListener('message', function(e) {
    if (e.data?.type === 'buildn:visual-edit') {
      enabled = e.data.enabled;
      if (!enabled && highlightEl) {
        highlightEl.remove();
        highlightEl = null;
      }
      document.body.style.cursor = enabled ? 'crosshair' : '';
    }
  });

  function getSelectorPath(el) {
    const parts = [];
    while (el && el !== document.body) {
      let selector = el.tagName.toLowerCase();
      if (el.id) {
        selector += '#' + el.id;
        parts.unshift(selector);
        break;
      }
      if (el.className && typeof el.className === 'string') {
        const classes = el.className.trim().split(/\\s+/).slice(0, 3).join('.');
        if (classes) selector += '.' + classes;
      }
      const parent = el.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(el) + 1;
          selector += ':nth-of-type(' + index + ')';
        }
      }
      parts.unshift(selector);
      el = el.parentElement;
    }
    return parts.join(' > ');
  }

  function showHighlight(rect) {
    if (!highlightEl) {
      highlightEl = document.createElement('div');
      highlightEl.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #3b82f6;background:rgba(59,130,246,0.1);z-index:99999;transition:all 0.1s ease;';
      document.body.appendChild(highlightEl);
    }
    highlightEl.style.top = rect.top + 'px';
    highlightEl.style.left = rect.left + 'px';
    highlightEl.style.width = rect.width + 'px';
    highlightEl.style.height = rect.height + 'px';
  }

  document.addEventListener('mousemove', function(e) {
    if (!enabled) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && el !== document.body && el !== document.documentElement) {
      showHighlight(el.getBoundingClientRect());
    }
  });

  document.addEventListener('click', function(e) {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();

    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === document.body || el === document.documentElement) return;

    const rect = el.getBoundingClientRect();
    showHighlight(rect);

    window.parent.postMessage({
      type: 'buildn:element-selected',
      payload: {
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || '').trim().slice(0, 100),
        classes: el.className || '',
        selector: getSelectorPath(el),
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      }
    }, '*');
  }, true);
})();
`
