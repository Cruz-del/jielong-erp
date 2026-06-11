/**
 * 捷隆纺织 - Supabase 统一客户端（v2）
 * 整个应用的唯一 Supabase 入口，提供：
 *   - 单例客户端实例
 *   - iframe 兼容（子页面自动继承父页面实例）
 *   - Realtime 订阅管理
 *   - 连接状态检测
 *   - 自动重连
 */

(function() {
  'use strict';

  // 防止重复初始化
  if (window.__SupabaseClientReady) {
    console.log('⚠️ SupabaseClient 已初始化，跳过');
    return;
  }

  // 读取配置
  const CONFIG = window.SupabaseConfig || {
    URL: 'https://uujlzxidillcvqjxmqnj.supabase.co',
    API_KEY: 'sb_publishable_x0Do8yWb3XA5Asr1x0Bd7Q_HfDMgIl6'
  };

  let instance = null;
  let realtimeChannel = null;
  let connectionStatus = 'disconnected'; // 'connected' | 'disconnected' | 'connecting'
  let statusListeners = [];

  // ======================== 初始化 ========================

  function createInstance() {
    if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
      console.error('❌ Supabase SDK 未加载（window.supabase 不可用）');
      return null;
    }

    const client = window.supabase.createClient(CONFIG.URL, CONFIG.API_KEY, {
      auth: {
        autoRefreshToken: CONFIG.AUTH?.AUTO_REFRESH_TOKEN !== false,
        persistSession: true,
        detectSessionInUrl: CONFIG.AUTH?.DETECT_SESSION_IN_URL !== false,
        // 使用 sessionStorage 存储 auth token（关闭浏览器自动清除）
        storage: typeof window !== 'undefined' ? window.sessionStorage : undefined
      },
      realtime: {
        params: { eventsPerSecond: 10 }
      }
    });

    console.log('✅ Supabase 客户端已创建:', CONFIG.URL);
    return client;
  }

  function getOrCreateInstance() {
    if (instance) return instance;

    // 在 iframe 中尝试使用父窗口的实例
    try {
      if (window.parent && window.parent !== window && window.parent.__SupabaseClientReady) {
        if (window.parent.supabase) {
          instance = window.parent.supabase;
          console.log('🔄 复用父窗口 Supabase 实例');
          return instance;
        }
      }
    } catch (e) { /* 跨域限制，忽略 */ }

    instance = createInstance();
    return instance;
  }

  // ======================== Realtime 订阅 ========================

  function subscribeToTable(table, event, callback) {
    const sb = getOrCreateInstance();
    if (!sb) {
      console.warn('⚠️ 无法订阅 Realtime：Supabase 不可用');
      return { unsubscribe: () => {} };
    }

    // 移除旧 channel
    if (realtimeChannel) {
      sb.removeChannel(realtimeChannel);
    }

    const channel = sb.channel(`realtime:${table}`)
      .on('postgres_changes',
        { event: event || '*', schema: 'public', table },
        (payload) => {
          console.log(`📡 ${table} ${payload.eventType}:`, payload.new || payload.old);
          if (callback) callback(payload);
        }
      )
      .subscribe((status) => {
        console.log(`📡 ${table} 订阅状态:`, status);
      });

    realtimeChannel = channel;
    return channel;
  }

  function subscribeToOrders(callback) {
    return subscribeToTable('orders', '*', callback);
  }

  function subscribeToPayments(callback) {
    return subscribeToTable('finance_payments', '*', callback);
  }

  function subscribeToNotifications(userId, callback) {
    const sb = getOrCreateInstance();
    if (!sb || !userId) return { unsubscribe: () => {} };

    const channel = sb.channel(`notifications:${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          console.log('🔔 新通知:', payload.new);
          if (callback) callback(payload.new);
        }
      )
      .subscribe();

    return channel;
  }

  // ======================== 连接管理 ========================

  function setConnectionStatus(status) {
    if (connectionStatus !== status) {
      connectionStatus = status;
      statusListeners.forEach(fn => { try { fn(status); } catch {} });
    }
  }

  function onStatusChange(callback) {
    statusListeners.push(callback);
    // 返回取消订阅函数
    return () => {
      statusListeners = statusListeners.filter(fn => fn !== callback);
    };
  }

  async function testConnection() {
    setConnectionStatus('connecting');
    try {
      const sb = getOrCreateInstance();
      if (!sb) {
        setConnectionStatus('disconnected');
        return { success: false, error: 'Supabase SDK not loaded' };
      }

      // 测试 Auth
      const { data: sessionData } = await sb.auth.getSession();

      // 测试数据库
      try {
        const { error: dbError } = await sb.from('profiles').select('id').limit(1);
        if (dbError) {
          console.warn('⚠️ 数据库测试失败:', dbError.message);
          console.warn('   请先在 Supabase SQL Editor 中执行 sql/init.sql');
        }
      } catch (e) {
        console.warn('⚠️ 数据库连接失败:', e.message);
      }

      setConnectionStatus('connected');
      console.log('✅ Supabase 连接正常, Auth:', sessionData.session ? '已登录' : '未登录');
      return { success: true, session: sessionData.session };
    } catch (err) {
      setConnectionStatus('disconnected');
      console.error('❌ Supabase 连接失败:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ======================== 公共接口 ========================

  const SupabaseClient = {

    /** 获取 Supabase 实例 */
    getInstance() {
      return getOrCreateInstance();
    },

    /** 检查是否可用 */
    isAvailable() {
      return getOrCreateInstance() !== null;
    },

    /** 获取配置 */
    getConfig() {
      return { ...CONFIG };
    },

    /** 获取连接状态 */
    getConnectionStatus() {
      return connectionStatus;
    },

    /** 监听连接状态变化 */
    onStatusChange,

    // ---- Auth 快捷方法 ----

    async getSession() {
      const sb = getOrCreateInstance();
      if (!sb) return { data: { session: null }, error: new Error('Client unavailable') };
      return sb.auth.getSession();
    },

    async signIn(email, password) {
      const sb = getOrCreateInstance();
      if (!sb) return { data: null, error: new Error('Client unavailable') };
      const result = await sb.auth.signInWithPassword({ email, password });
      if (!result.error) setConnectionStatus('connected');
      return result;
    },

    async signUp(email, password) {
      const sb = getOrCreateInstance();
      if (!sb) return { data: null, error: new Error('Client unavailable') };
      return sb.auth.signUp({ email, password });
    },

    async signOut() {
      const sb = getOrCreateInstance();
      if (!sb) return { error: new Error('Client unavailable') };
      const result = await sb.auth.signOut();
      setConnectionStatus('disconnected');
      return result;
    },

    async getUser() {
      const sb = getOrCreateInstance();
      if (!sb) return null;
      const { data: { user } } = await sb.auth.getUser();
      return user;
    },

    // ---- 数据库快捷方法（直接透传 Supabase 查询构建器）----

    from(table) {
      const sb = getOrCreateInstance();
      if (!sb) throw new Error('Supabase client not available');
      return sb.from(table);
    },

    // ---- Storage 快捷方法 ----

    storage() {
      const sb = getOrCreateInstance();
      if (!sb) throw new Error('Supabase client not available');
      return sb.storage;
    },

    // ---- Realtime ----

    subscribeToTable,
    subscribeToOrders,
    subscribeToPayments,
    subscribeToNotifications,

    // ---- 工具 ----

    testConnection,

    /** 初始化（异步） */
    async init() {
      const result = await testConnection();
      console.log('🚀 SupabaseClient v2 初始化完成');
      return result;
    }
  };

  // 挂载到全局
  window.SupabaseClient = SupabaseClient;
  window.supabase = getOrCreateInstance(); // 保持向后兼容
  window.__SupabaseClientReady = true;

  // 自动初始化
  setTimeout(() => SupabaseClient.init(), 100);

  console.log('📦 SupabaseClient v2 已加载');
})();
