document.addEventListener('DOMContentLoaded', () => {
  const urlContainsInput = document.getElementById('urlContains');
  const newTitleInput = document.getElementById('newTitle');
  const addRuleBtn = document.getElementById('addRuleBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const manageRulesBtn = document.getElementById('manageRulesBtn');
  const rulesList = document.getElementById('rulesList');
  const errorDiv = document.getElementById('error');

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  function loadRules() {
    chrome.runtime.sendMessage({ action: 'getRules' }, (response) => {
      if (response && response.rules) {
        // rulesList.innerHTML = '';
        response.rules.forEach(rule => {
          const ruleItem = document.createElement('div');
          ruleItem.className = 'rule-item';
          ruleItem.innerHTML = `
            <div class="rule-info">
              <strong>包含:</strong> ${rule.urlContains}<br>
              <strong>重命名为:</strong> ${rule.newTitle}
            </div>
            <button class="remove-btn" data-id="${rule.id}">删除</button>
            <div style="clear:both"></div>
          `;
          rulesList.appendChild(ruleItem);
        });

        document.querySelectorAll('.remove-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            chrome.runtime.sendMessage({ action: 'removeRule', id: id }, () => {
              loadRules();
            });
          });
        });
      }
    });
  }

  addRuleBtn.addEventListener('click', () => {
    const urlContains = urlContainsInput.value.trim();
    const newTitle = newTitleInput.value.trim();

    if (!urlContains) {
      errorDiv.textContent = '请输入URL包含的字符';
      return;
    }
    if (!newTitle) {
      errorDiv.textContent = '请输入新标签名称';
      return;
    }

    errorDiv.textContent = '';

    const newRule = {
      id: generateId(),
      urlContains,
      newTitle,
      enabled: true
    };

    chrome.runtime.sendMessage({ action: 'addRule', rule: newRule }, () => {
      urlContainsInput.value = '';
      newTitleInput.value = '';
      loadRules();
    });
  });

  refreshBtn.addEventListener('click', loadRules);

  manageRulesBtn.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('options.html');
    }
  });

  // ✅ 自动填充完整 URL（不含协议）
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url) {
      try {
        const url = new URL(tabs[0].url);
        const cleanUrl = url.host + url.pathname + url.search + url.hash;
        urlContainsInput.value = cleanUrl;
      } catch (e) {
        urlContainsInput.value = tabs[0].url;
      }
    }
  });

  loadRules();
});