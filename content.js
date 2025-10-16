(function () {
  let rules = [];

  function fetchRules() {
    chrome.runtime.sendMessage(
      { action: 'getRulesFromContent' },
      (response) => {
        if (response && Array.isArray(response.rules)) {
          rules = response.rules;
          applyTitle();
        }
      }
    );
  }

  function getNewTitle() {
    const url = window.location.href.toLowerCase();
    for (const rule of rules) {
      if (rule.enabled !== false && url.includes(rule.urlContains.toLowerCase())) {
        return rule.newTitle;
      }
    }
    return null;
  }

  function applyTitle() {
    const newTitle = getNewTitle();
    if (newTitle && document.title !== newTitle) {
      document.title = newTitle;
      const titleElem = document.querySelector('title');
      if (titleElem) titleElem.textContent = newTitle;
    }
  }

  document.addEventListener('DOMContentLoaded', applyTitle, { once: true });

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.target === document.head) {
        const titleElement = document.querySelector('title');
        if (titleElement) {
          const expectedTitle = getNewTitle();
          if (expectedTitle && titleElement.textContent !== expectedTitle) {
            titleElement.textContent = expectedTitle;
            document.title = expectedTitle;
          }
        }
      }
    }
  });

  if (document.head) {
    observer.observe(document.head, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.head, { childList: true, subtree: true });
    }, { once: true });
  }

  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    setTimeout(applyTitle, 0);
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    setTimeout(applyTitle, 0);
  };

  window.addEventListener('popstate', applyTitle);

  fetchRules();

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'rulesUpdated') {
      rules = request.rules;
      applyTitle();
    }
  });
})();