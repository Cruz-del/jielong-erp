/**
 * 捷隆纺织 - 数据同步模块 v2
 * 基于 Supabase Realtime 订阅 + 智能轮询回退
 */

const DataSync = {
  channels: {},
  subscribers: {},
  pollIntervals: {},
  isRealtimeAvailable: false,

  /**
   * 初始化同步系统
   */
  async init() {
    console.log('📡 数据同步模块初始化...');

    // 检测 Realtime 是否可用
    if (window.SupabaseClient && window.SupabaseClient.isAvailable()) {
      this.isRealtimeAvailable = true;
      console.log('✅ 使用 Supabase Realtime 模式');
    } else {
      console.log('⚠️ Realtime 不可用，使用轮询模式');
      this.startPolling();
    }

    // 监听连接状态变化
    if (window.SupabaseClient && window.SupabaseClient.onStatusChange) {
      window.SupabaseClient.onStatusChange((status) => {
        if (status === 'connected' && !this.isRealtimeAvailable) {
          this.isRealtimeAvailable = true;
          this.startRealtimeSubscriptions();
          this.stopPolling();
        } else if (status === 'disconnected' && this.isRealtimeAvailable) {
          this.isRealtimeAvailable = false;
          this.startPolling();
        }
      });
    }
  },

  // ======================== Realtime 订阅 ========================

  /** 启动所有 Realtime 订阅 */
  startRealtimeSubscriptions() {
    this.subscribeToOrders();
    this.subscribeToPayments();
    this.subscribeToNotifications();
  },

  /** 订阅订单变更 */
  subscribeToOrders() {
    if (this.channels.orders) return;
    if (!window.SupabaseClient) return;

    this.channels.orders = window.SupabaseClient.subscribeToOrders((payload) => {
      const { eventType, new: newData, old: oldData } = payload;
      console.log(`📡 订单变更 [${eventType}]:`, newData?.pl_number || oldData?.pl_number);

      // 通知所有订阅者
      this.notify('orders', { eventType, newData, oldData });

      // 特定事件处理
      if (eventType === 'INSERT' && newData) {
        this.notify('order:created', newData);
      } else if (eventType === 'UPDATE' && newData) {
        this.notify('order:updated', newData);
        if (newData.is_delayed && !(oldData?.is_delayed)) {
          this.notify('order:delayed', newData);
        }
      } else if (eventType === 'DELETE' && oldData) {
        this.notify('order:deleted', oldData);
      }
    });
  },

  /** 订阅回款变更 */
  subscribeToPayments() {
    if (this.channels.payments) return;
    if (!window.SupabaseClient) return;

    this.channels.payments = window.SupabaseClient.subscribeToPayments((payload) => {
      const { eventType, new: newData } = payload;
      this.notify('payments', { eventType, newData });

      if (eventType === 'UPDATE' && newData?.verified) {
        this.notify('payment:verified', newData);
      }
    });
  },

  /** 订阅通知 */
  async subscribeToNotifications() {
    if (this.channels.notifications) return;
    if (!window.SupabaseClient) return;

    const user = await Auth.getUser();
    if (!user?.id) return;

    this.channels.notifications = window.SupabaseClient.subscribeToNotifications(user.id, (notification) => {
      this.notify('notification:new', notification);
      // 触发 Toast 提示
      if (window.Toast) {
        Toast.info(notification.title || '新通知');
      }
    });
  },

  // ======================== 轮询回退 ========================

  /** 启动轮询（Realtime 不可用时） */
  startPolling() {
    if (Object.keys(this.pollIntervals).length > 0) return;

    // 订单数据：每5秒轮询一次
    this.pollIntervals.orders = setInterval(async () => {
      if (window.DataService) {
        const { data } = await window.DataService.orders.list({ limit: 20 });
        if (data) this.notify('orders:poll', data);
      }
    }, 5000);

    // 财务数据：每30秒轮询一次
    this.pollIntervals.payments = setInterval(async () => {
      if (window.DataService) {
        const { data } = await window.DataService.finance.listPayments();
        if (data) this.notify('payments:poll', data);
      }
    }, 30000);

    // 通知：每15秒轮询一次
    this.pollIntervals.notifications = setInterval(async () => {
      if (window.DataService) {
        const count = await window.DataService.notifications.getUnreadCount();
        if (count > 0) this.notify('notifications:unread_count', count);
      }
    }, 15000);

    console.log('🔄 轮询模式已启动（订单5s/财务30s/通知15s）');
  },

  /** 停止所有轮询 */
  stopPolling() {
    Object.values(this.pollIntervals).forEach(clearInterval);
    this.pollIntervals = {};
    console.log('🔄 轮询模式已停止');
  },

  // ======================== 订阅管理 ========================

  /**
   * 订阅数据变化
   * @param {string} eventType - 事件类型（如 'order:updated', 'orders'）
   * @param {Function} callback
   * @returns {Function} 取消订阅函数
   */
  subscribe(eventType, callback) {
    if (!this.subscribers[eventType]) {
      this.subscribers[eventType] = [];
    }
    this.subscribers[eventType].push(callback);
    console.log(`📡 订阅: ${eventType} (${this.subscribers[eventType].length}个监听器)`);

    return () => {
      this.subscribers[eventType] = this.subscribers[eventType].filter(cb => cb !== callback);
    };
  },

  /** 通知所有订阅者 */
  notify(eventType, data) {
    const callbacks = this.subscribers[eventType] || [];
    callbacks.forEach(cb => {
      try { cb(data); } catch (e) { console.error('通知失败:', e); }
    });

    // 也通知通配符订阅者
    const wildcardCallbacks = this.subscribers['*'] || [];
    wildcardCallbacks.forEach(cb => {
      try { cb(eventType, data); } catch (e) { /* ignore */ }
    });
  },

  // ======================== 主动操作 ========================

  /** 触发订单状态更新 */
  async triggerOrderUpdate(orderId, updates) {
    if (window.DataService) {
      return window.DataService.orders.update(orderId, updates);
    }
    // 回退到 localStorage
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      orders[idx] = { ...orders[idx], ...updates, updatedAt: new Date().toISOString() };
      localStorage.setItem('orders', JSON.stringify(orders));
    }
  },

  /** 清理所有订阅 */
  destroy() {
    // 移除 Realtime channels
    Object.values(this.channels).forEach(ch => {
      try { ch.unsubscribe(); } catch {}
    });
    this.channels = {};

    // 停止轮询
    this.stopPolling();

    // 清空订阅者
    this.subscribers = {};
    console.log('📡 数据同步已销毁');
  }
};

// 挂载全局
window.DataSync = DataSync;

// 延迟初始化（等待 SupabaseClient 就绪）
setTimeout(() => DataSync.init(), 500);

console.log('📡 DataSync v2 模块已加载');
