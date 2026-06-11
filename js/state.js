/**
 * 捷隆纺织 - 状态管理和持久化工具
 * 基于 LocalStorage 和 SessionStorage 的数据管理
 */

// 应用状态管理
const AppState = {
  // 状态存储
  _state: {
    currentOrder: null,
    orderSteps: {},
    filterConditions: {},
    userSettings: {
      theme: 'light',
      defaultCurrency: 'USD',
      language: 'zh-CN',
      notifications: {
        email: true,
        wechat: true,
        browser: true
      }
    },
    recentItems: {
      customers: [],
      factories: []
    },
    aiHistory: []
  },

  // 初始化：从本地存储加载
  init() {
    try {
      const savedSettings = localStorage.getItem('jl_user_settings');
      if (savedSettings) {
        this._state.userSettings = { ...this._state.userSettings, ...JSON.parse(savedSettings) };
      }

      const savedRecent = localStorage.getItem('jl_recent_items');
      if (savedRecent) {
        this._state.recentItems = JSON.parse(savedRecent);
      }

      const savedAIHistory = localStorage.getItem('jl_ai_history');
      if (savedAIHistory) {
        this._state.aiHistory = JSON.parse(savedAIHistory);
      }
    } catch (e) {
      console.error('状态初始化失败:', e);
    }
  },

  // 获取状态
  get(key) {
    return key ? this._state[key] : this._state;
  },

  // 设置状态
  set(key, value) {
    this._state[key] = value;
    
    // 自动持久化
    if (key === 'userSettings') {
      this.saveToLocal('jl_user_settings', value);
    } else if (key === 'recentItems') {
      this.saveToLocal('jl_recent_items', value);
    } else if (key === 'aiHistory') {
      // AI历史只保存最近10条
      if (Array.isArray(value) && value.length > 10) {
        value = value.slice(-10);
      }
      this.saveToLocal('jl_ai_history', value);
    }
  },

  // 保存到本地存储
  saveToLocal(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('保存失败:', e);
    }
  },

  // 添加最近使用的客户/工厂
  addRecentItem(type, name) {
    const items = this._state.recentItems[type];
    // 移除已存在的
    const filtered = items.filter(item => item !== name);
    // 添加到开头
    filtered.unshift(name);
    // 只保留最近3个
    this._state.recentItems[type] = filtered.slice(0, 3);
    this.set('recentItems', this._state.recentItems);
  },

  // 添加AI对话历史
  addAIHistory(conversation) {
    this._state.aiHistory.push(conversation);
    // 只保留最近10条
    if (this._state.aiHistory.length > 10) {
      this._state.aiHistory = this._state.aiHistory.slice(-10);
    }
    this.set('aiHistory', this._state.aiHistory);
  },

  // 更新订单状态
  updateOrderStep(orderId, step, data) {
    if (!this._state.orderSteps[orderId]) {
      this._state.orderSteps[orderId] = {};
    }
    this._state.orderSteps[orderId][step] = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    
    // 保存到session
    try {
      sessionStorage.setItem(`jl_order_${orderId}`, JSON.stringify(this._state.orderSteps[orderId]));
    } catch (e) {
      console.error('保存订单状态失败:', e);
    }
  },

  // 获取订单状态
  getOrderStep(orderId, step) {
    if (!this._state.orderSteps[orderId]) {
      try {
        const saved = sessionStorage.getItem(`jl_order_${orderId}`);
        if (saved) {
          this._state.orderSteps[orderId] = JSON.parse(saved);
        }
      } catch (e) {
        console.error('读取订单状态失败:', e);
      }
    }
    return step ? this._state.orderSteps[orderId]?.[step] : this._state.orderSteps[orderId];
  },

  // 保存筛选条件
  saveFilter(pageKey, filters) {
    this._state.filterConditions[pageKey] = filters;
    try {
      sessionStorage.setItem(`jl_filters_${pageKey}`, JSON.stringify(filters));
    } catch (e) {
      console.error('保存筛选条件失败:', e);
    }
  },

  // 获取筛选条件
  getFilter(pageKey) {
    if (!this._state.filterConditions[pageKey]) {
      try {
        const saved = sessionStorage.getItem(`jl_filters_${pageKey}`);
        if (saved) {
          this._state.filterConditions[pageKey] = JSON.parse(saved);
        }
      } catch (e) {
        console.error('读取筛选条件失败:', e);
      }
    }
    return this._state.filterConditions[pageKey];
  }
};

// 表单草稿管理
const FormDraft = {
  // 保存草稿
  save(formKey, data) {
    try {
      sessionStorage.setItem(`jl_draft_${formKey}`, JSON.stringify({
        data,
        savedAt: new Date().toISOString()
      }));
    } catch (e) {
      console.error('保存草稿失败:', e);
    }
  },

  // 读取草稿
  load(formKey) {
    try {
      const draft = sessionStorage.getItem(`jl_draft_${formKey}`);
      if (draft) {
        return JSON.parse(draft);
      }
    } catch (e) {
      console.error('读取草稿失败:', e);
    }
    return null;
  },

  // 删除草稿
  remove(formKey) {
    try {
      sessionStorage.removeItem(`jl_draft_${formKey}`);
    } catch (e) {
      console.error('删除草稿失败:', e);
    }
  },

  // 检查是否有草稿
  hasDraft(formKey) {
    return !!sessionStorage.getItem(`jl_draft_${formKey}`);
  }
};

// 自动保存管理器
const AutoSave = {
  timers: {},

  // 开始自动保存
  start(key, getData, interval = 30000) {
    this.stop(key);
    
    this.timers[key] = setInterval(() => {
      const data = getData();
      if (data) {
        FormDraft.save(key, data);
        Toast.info('草稿已自动保存');
      }
    }, interval);
  },

  // 停止自动保存
  stop(key) {
    if (this.timers[key]) {
      clearInterval(this.timers[key]);
      delete this.timers[key];
    }
  },

  // 停止所有
  stopAll() {
    Object.keys(this.timers).forEach(key => this.stop(key));
  }
};

// 页面离开确认
const PageLeaveGuard = {
  enabled: false,
  hasChanges: false,

  enable() {
    this.enabled = true;
    this.hasChanges = false;
    
    window.addEventListener('beforeunload', this.handler);
    window.addEventListener('popstate', this.handler);
  },

  disable() {
    this.enabled = false;
    this.hasChanges = false;
    
    window.removeEventListener('beforeunload', this.handler);
    window.removeEventListener('popstate', this.handler);
  },

  handler(e) {
    if (PageLeaveGuard.hasChanges) {
      e.preventDefault();
      e.returnValue = '有未保存的更改，确定要离开吗？';
      return e.returnValue;
    }
  },

  setChanged(changed = true) {
    this.hasChanges = changed;
  },

  // 显示确认对话框
  confirm(message = '有未保存的更改，是否放弃？') {
    return new Promise((resolve) => {
      if (!this.hasChanges) {
        resolve(true);
        return;
      }

      ConfirmModal.show({
        title: '确认离开',
        message: message,
        confirmText: '离开',
        cancelText: '留下',
        type: 'warning',
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      });
    });
  }
};

// AI对话上下文管理
const AIContext = {
  maxHistory: 5,
  history: [],

  init() {
    const saved = AppState.get('aiHistory');
    if (saved) {
      this.history = saved;
    }
  },

  addExchange(question, answer) {
    this.history.push({
      question,
      answer,
      timestamp: new Date().toISOString()
    });
    
    // 只保留最近5轮
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
    
    AppState.set('aiHistory', this.history);
  },

  getHistory() {
    return this.history;
  },

  clearHistory() {
    this.history = [];
    AppState.set('aiHistory', []);
  },

  // 构建上下文提示
  buildContextPrompt() {
    if (this.history.length === 0) return '';
    
    let context = '对话历史：\n';
    this.history.forEach((item, index) => {
      context += `${index + 1}. 用户：${item.question}\n`;
      context += `   助手：${item.answer}\n`;
    });
    return context;
  }
};

// 导出全局对象
window.AppState = AppState;
window.FormDraft = FormDraft;
window.AutoSave = AutoSave;
window.PageLeaveGuard = PageLeaveGuard;
window.AIContext = AIContext;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  AppState.init();
  AIContext.init();
});
