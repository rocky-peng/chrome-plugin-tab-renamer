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

  // 导出规则
  document.getElementById('exportRulesBtn').addEventListener('click', () => {
    if (!rules || rules.length === 0) {
      alert('当前没有规则可导出！');
      return;
    }

    const dataStr = JSON.stringify(rules, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `tab-renamer-rules-${new Date().toISOString().slice(0,10)}.json`;
    a.click();

    URL.revokeObjectURL(url);
  });

  // 导入规则
  document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(event) {
      try {
        const importedRules = JSON.parse(event.target.result);

        if (!Array.isArray(importedRules)) {
          throw new Error('文件格式错误：应为规则数组');
        }

        // 验证每条规则结构
        const validRules = importedRules.filter(rule =>
            rule && typeof rule === 'object' &&
            typeof rule.urlContains === 'string' &&
            typeof rule.newTitle === 'string' &&
            rule.id
        );

        if (validRules.length === 0) {
          alert('导入失败：文件中没有有效规则');
          return;
        }

        // 合并规则：去重（基于 ID）
        const existingIds = new Set(rules.map(r => r.id));
        const newRules = validRules.filter(r => !existingIds.has(r.id));

        if (newRules.length === 0) {
          alert('所有规则已存在，无需导入');
          return;
        }

        rules = [...rules, ...newRules];

        try {
          await saveRulesToStorage();
          renderRules();
          alert(`成功导入 ${newRules.length} 条新规则！`);
        } catch (error) {
          alert('保存失败，请重试');
          console.error('导入后保存失败:', error);
          loadRules(); // 恢复
        }

      } catch (err) {
        alert(`导入失败：${err.message || '文件格式不正确'}`);
        console.error('导入错误:', err);
      } finally {
        e.target.value = ''; // 清空文件选择
      }
    };
    reader.readAsText(file);
  });

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