/**
 * 捷隆纺织 - 键盘快捷键和辅助功能
 */

// 键盘快捷键管理
const KeyboardShortcuts = {
  shortcuts: {},

  init() {
    document.addEventListener('keydown', (e) => {
      // 忽略输入框中的快捷键（除了全局快捷键）
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
      
      // 全局快捷键（始终响应）
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'k' || e.key === 'K') {
          e.preventDefault();
          this.focusGlobalSearch();
        } else if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          this.triggerSave();
        }
        return;
      }

      // 页面级快捷键
      if (!isInput) {
        const shortcut = this.shortcuts[e.key];
        if (shortcut) {
          e.preventDefault();
          shortcut();
        }
      }
    });
  },

  // 注册快捷键
  register(key, callback) {
    this.shortcuts[key] = callback;
  },

  // 聚焦全局搜索
  focusGlobalSearch() {
    const searchInput = document.querySelector('.global-search-input, #global-search, input[placeholder*="搜索"]');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
      Toast.info('已聚焦搜索框');
    }
  },

  // 触发保存
  triggerSave() {
    // 查找页面上的保存按钮
    const saveBtn = document.querySelector('[data-action="save"], .save-btn, button:contains("保存")');
    if (saveBtn) {
      saveBtn.click();
    }
    Toast.info('Ctrl+S 快捷保存');
  }
};

// 无障碍功能
const Accessibility = {
  // 初始化
  init() {
    this.addSkipLinks();
    this.enhanceFocusStyles();
    this.addARIA();
  },

  // 添加跳过链接
  addSkipLinks() {
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.textContent = '跳转到主要内容';
    skipLink.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      z-index: 9999;
      padding: 10px 20px;
      background: #3b82f6;
      color: white;
      text-decoration: none;
      border-radius: 0 0 8px 0;
    `;
    skipLink.onfocus = function() {
      this.style.left = '0';
    };
    skipLink.onblur = function() {
      this.style.left = '-9999px';
    };
    document.body.insertBefore(skipLink, document.body.firstChild);
  },

  // 增强焦点样式
  enhanceFocusStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* 增强焦点指示 */
      *:focus {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }
      
      /* 焦点在按钮上时 */
      button:focus-visible,
      a:focus-visible,
      input:focus-visible,
      select:focus-visible,
      textarea:focus-visible {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
      }
      
      /* 隐藏默认焦点环 */
      *:focus:not(:focus-visible) {
        outline: none;
      }
      
      /* 高对比度模式支持 */
      @media (prefers-contrast: high) {
        .btn-primary,
        button {
          border: 2px solid currentColor;
        }
      }
    `;
    document.head.appendChild(style);
  },

  // 添加ARIA属性
  addARIA() {
    // 为所有图标按钮添加aria-label
    document.querySelectorAll('button i, a i').forEach(icon => {
      const button = icon.closest('button, a');
      if (button && !button.getAttribute('aria-label')) {
        const iconClass = icon.className.replace('fas ', '').replace('far ', '');
        const label = this.getLabelFromIcon(iconClass);
        if (label) {
          button.setAttribute('aria-label', label);
        }
      }
    });

    // 为所有表单添加关联
    document.querySelectorAll('label:not([for]), input:not([id]), select:not([id]), textarea:not([id])').forEach((el, index) => {
      if (!el.getAttribute('id')) {
        el.setAttribute('id', `form-field-${index}`);
      }
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
        const label = el.closest('.form-group')?.querySelector('label');
        if (label && !label.getAttribute('for')) {
          label.setAttribute('for', el.getAttribute('id'));
        }
      }
    });
  },

  // 从图标类获取标签
  getLabelFromIcon(iconClass) {
    const labels = {
      'plus': '新增',
      'trash': '删除',
      'edit': '编辑',
      'save': '保存',
      'download': '下载',
      'upload': '上传',
      'print': '打印',
      'search': '搜索',
      'filter': '筛选',
      'close': '关闭',
      'check': '确认',
      'times': '取消',
      'eye': '查看',
      'arrow-left': '返回',
      'arrow-right': '前进',
      'cog': '设置',
      'bell': '通知',
      'user': '用户',
      'sign-out': '退出登录'
    };
    return labels[iconClass] || '';
  },

  // 公告（用于屏幕阅读器）
  announce(message, priority = 'polite') {
    let announcer = document.getElementById('aria-announcer');
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'aria-announcer';
      announcer.setAttribute('aria-live', priority);
      announcer.setAttribute('aria-atomic', 'true');
      announcer.style.cssText = `
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      `;
      document.body.appendChild(announcer);
    }
    
    announcer.textContent = message;
    
    // 清除
    setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  }
};

// 首次使用引导
const Onboarding = {
  storageKey: 'jl_onboarding_completed',
  steps: [],

  // 检查是否首次使用
  isFirstTime() {
    return !localStorage.getItem(this.storageKey);
  },

  // 标记为已完成
  markComplete() {
    localStorage.setItem(this.storageKey, 'true');
  },

  // 开始引导
  start(steps) {
    if (!this.isFirstTime()) return;
    
    this.steps = steps;
    let currentStep = 0;

    const showStep = () => {
      if (currentStep >= steps.length) {
        this.markComplete();
        return;
      }

      const step = steps[currentStep];
      ConfirmModal.show({
        title: step.title,
        message: step.message,
        confirmText: currentStep < steps.length - 1 ? '下一步' : '知道了',
        cancelText: '跳过',
        type: 'info',
        onConfirm: () => {
          currentStep++;
          showStep();
        },
        onCancel: () => {
          this.markComplete();
        }
      });
    };

    setTimeout(showStep, 1000);
  },

  // 显示提示
  showTip(element, message) {
    const tip = document.createElement('div');
    tip.style.cssText = `
      position: absolute;
      background: #1f2937;
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      max-width: 250px;
      z-index: 9999;
      animation: fadeIn 0.3s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    tip.innerHTML = message;

    const rect = element.getBoundingClientRect();
    tip.style.top = (rect.bottom + 10) + 'px';
    tip.style.left = rect.left + 'px';

    document.body.appendChild(tip);

    setTimeout(() => {
      tip.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => tip.remove(), 300);
    }, 3000);
  }
};

// 导出全局对象
window.KeyboardShortcuts = KeyboardShortcuts;
window.Accessibility = Accessibility;
window.Onboarding = Onboarding;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  KeyboardShortcuts.init();
  Accessibility.init();
});
