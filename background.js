let rules = [];

async function loadRules() {
  try {
    const result = await chrome.storage.local.get(['tabRenamerRules']);
    let unsortedRules = result.tabRenamerRules || [];

    // 排序：1. 按域名升序；2. 同域名按 urlContains 长度降序
    rules = unsortedRules.sort((a, b) => {
      const extractDomain = (str) => {
        const match = str.toLowerCase().match(/([a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]+/);
        return match ? match[0] : str.toLowerCase();
      };

      const domainA = extractDomain(a.urlContains);
      const domainB = extractDomain(b.urlContains);

      if (domainA !== domainB) {
        return domainA.localeCompare(domainB);
      }

      return b.urlContains.length - a.urlContains.length;
    });

    console.log('Loaded and sorted rules:', rules);
    broadcastRulesUpdate();
  } catch (error) {
    console.error('Failed to load rules:', error);
    rules = [];
  }
}

async function saveRules() {
  try {
    await chrome.storage.local.set({ tabRenamerRules: rules });
    console.log('Rules saved:', rules);
    broadcastRulesUpdate();
  } catch (error) {
    console.error('Failed to save rules:', error);
  }
}

function broadcastRulesUpdate() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { 
          action: 'rulesUpdated', 
          rules: rules 
        }).catch(() => {});
      }
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'addRule') {
    rules.push(request.rule);
    saveRules().then(() => {
      broadcastRulesUpdate();
      sendResponse({ success: true });
    }).catch(sendResponse);
    return true;
  } else if (request.action === 'getRules') {
    sendResponse({ rules: rules });
  } else if (request.action === 'removeRule') {
    const index = rules.findIndex(r => r.id === request.id);
    if (index > -1) {
      rules.splice(index, 1);
      saveRules().then(() => {
        broadcastRulesUpdate();
        sendResponse({ success: true });
      }).catch(sendResponse);
      return true;
    }
  } else if (request.action === 'rulesUpdated') {
    rules = request.rules;
    broadcastRulesUpdate();
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'getRulesFromContent') {
    sendResponse({ rules: rules });
    return true;
  }
});

loadRules();