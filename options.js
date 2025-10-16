document.addEventListener('DOMContentLoaded', () => {
  let rules = [];

  // 保存规则并通知
  function saveRulesToStorage() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ tabRenamerRules: rules }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          chrome.runtime.sendMessage({ action: 'rulesUpdated', rules: rules });
          resolve();
        }
      });
    });
  }

  function renderRules() {
    const rulesList = document.getElementById('rulesList');
    
    if (!rules || rules.length === 0) {
      rulesList.innerHTML = '<div class="empty-state">暂无规则，去弹窗页面添加吧！</div>';
      return;
    }

    const fragment = document.createDocumentFragment();

    rules.forEach(rule => {
      const ruleItem = document.createElement('div');
      ruleItem.className = 'rule-item';
      ruleItem.dataset.id = rule.id;

      const escapedUrl = rule.urlContains
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

      const escapedTitle = rule.newTitle
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

      ruleItem.innerHTML = `
        <input type="text" 
               class="rule-field url-field ${rule.enabled !== false ? 'editable' : ''}" 
               value="${escapedUrl}" 
               ${rule.enabled === false ? 'disabled' : ''}>

        <input type="text" 
               class="rule-field title-field ${rule.enabled !== false ? 'editable' : ''}" 
               value="${escapedTitle}" 
               ${rule.enabled === false ? 'disabled' : ''}>

        <button class="toggle-btn ${rule.enabled !== false ? 'enabled' : 'disabled'}">
          ${rule.enabled !== false ? '启用' : '禁用'}
        </button>

        <button class="remove-btn">删除</button>
      `;
      
      fragment.appendChild(ruleItem);
    });

    rulesList.innerHTML = '';
    rulesList.appendChild(fragment);
  }

  // 事件委托
  document.getElementById('rulesList').addEventListener('click', async (e) => {
    const ruleItem = e.target.closest('.rule-item');
    if (!ruleItem) return;

    const id = ruleItem.dataset.id;

    // 删除
    if (e.target.classList.contains('remove-btn')) {
      if (!confirm('确定要删除这条规则吗？')) return;
      rules = rules.filter(r => r.id !== id);
      try {
        await saveRulesToStorage();
        renderRules();
      } catch (error) {
        alert('删除失败，请重试');
        console.error('删除失败:', error);
        loadRules(); // 恢复
      }
    }

    // 启用/禁用
    if (e.target.classList.contains('toggle-btn')) {
      const rule = rules.find(r => r.id === id);
      if (rule) {
        rule.enabled = !rule.enabled;
        try {
          await saveRulesToStorage();
          renderRules();
        } catch (error) {
          alert('更新失败，请重试');
          console.error('更新失败:', error);
          loadRules();
        }
      }
    }
  });

  // 编辑字段
  document.getElementById('rulesList').addEventListener('dblclick', (e) => {
    if (e.target.classList.contains('rule-field') && !e.target.disabled) {
      e.target.classList.add('editable');
      e.target.dataset.originalValue = e.target.value;
      e.target.focus();
    }
  });

  document.getElementById('rulesList').addEventListener('blur', async (e) => {
    if (e.target.classList.contains('rule-field') && e.target.classList.contains('editable')) {
      const id = e.target.closest('.rule-item').dataset.id;
      const field = e.target.classList.contains('url-field') ? 'urlContains' : 'newTitle';
      const value = e.target.value.trim();

      if (!value) {
        alert('字段不能为空！');
        e.target.value = e.target.dataset.originalValue || '';
      } else {
        const rule = rules.find(r => r.id === id);
        if (rule) {
          rule[field] = value;
          try {
            await saveRulesToStorage();
            renderRules();
          } catch (error) {
            alert('保存失败');
            loadRules();
          }
        }
      }
      e.target.classList.remove('editable');
    }
  }, true);

  document.getElementById('rulesList').addEventListener('keypress', async (e) => {
    if (e.target.classList.contains('rule-field') && e.key === 'Enter') {
      e.target.blur(); // 触发 blur 事件保存
    }
  });

  function loadRules() {
    chrome.runtime.sendMessage({ action: 'getRules' }, (response) => {
      if (response && Array.isArray(response.rules)) {
        rules = response.rules;
        renderRules();
      }
    });
  }

  loadRules();
});