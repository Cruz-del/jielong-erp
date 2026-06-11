/**
 * 捷隆纺织 - 统一数据服务层
 * 所有业务数据操作通过此模块访问 Supabase
 * 提供缓存、错误处理、离线回退能力
 */

const DataService = (function() {
  'use strict';

  // ======================== 内部工具 ========================

  function getSB() {
    // 优先使用统一的 SupabaseClient
    if (window.SupabaseClient && window.SupabaseClient.isAvailable()) {
      return window.SupabaseClient.getInstance();
    }
    // 回退到全局 supabase 实例
    if (window.supabase) return window.supabase;
    console.error('❌ Supabase 实例不可用');
    return null;
  }

  // 安全执行 Supabase 查询，统一错误处理
  async function safeQuery(fn, fallback = null) {
    try {
      const sb = getSB();
      if (!sb) {
        console.warn('⚠️ Supabase 不可用，返回回退数据');
        return { data: fallback, error: new Error('Supabase not available'), fromFallback: true };
      }
      return await fn(sb);
    } catch (err) {
      console.error('❌ 数据查询失败:', err.message);
      return { data: fallback, error: err, fromFallback: true };
    }
  }

  // 从 localStorage 读取缓存
  function getCache(key) {
    try {
      const raw = localStorage.getItem('jl_cache_' + key);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      // 缓存5分钟有效
      if (Date.now() - cached.ts > 300000) return null;
      return cached.data;
    } catch { return null; }
  }

  // 写入 localStorage 缓存
  function setCache(key, data) {
    try {
      localStorage.setItem('jl_cache_' + key, JSON.stringify({ data, ts: Date.now() }));
    } catch { /* quota exceeded, ignore */ }
  }

  // 生成 PL 编号
  function generatePLNumber() {
    const now = new Date();
    const y = now.getFullYear();
    const seq = Math.floor(Math.random() * 9000) + 1000;
    return `PL-${y}-${seq}`;
  }

  // ======================== 订单模块 ========================

  const orders = {
    /** 获取订单列表 */
    async list(filters = {}) {
      const cacheKey = 'orders_list_' + JSON.stringify(filters);
      const cached = getCache(cacheKey);

      const result = await safeQuery(async (sb) => {
        let query = sb.from('orders').select(`
          *,
          factory:factories(name),
          assignee:profiles!orders_assigned_to_fkey(name)
        `);

        if (filters.status) query = query.eq('status', filters.status);
        if (filters.search) query = query.or(`pl_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,design_pattern.ilike.%${filters.search}%`);
        if (filters.isDelayed) query = query.eq('is_delayed', true);
        if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);

        query = query.order('created_at', { ascending: false });
        if (filters.limit) query = query.limit(filters.limit);

        return query;
      });

      if (!result.fromFallback && result.data) {
        setCache(cacheKey, result.data);
      }
      return result;
    },

    /** 获取单个订单详情 */
    async getById(orderId) {
      return safeQuery(async (sb) => {
        const { data, error } = await sb.from('orders')
          .select(`
            *,
            factory:factories(*),
            assignee:profiles!orders_assigned_to_fkey(name,phone),
            creator:profiles!orders_created_by_fkey(name),
            steps:order_steps(*),
            files:order_files(*),
            payments:finance_payments(*),
            design:design_productions(*),
            loading:loading_plans(*),
            docs:documents(*)
          `)
          .eq('id', orderId)
          .single();
        return { data, error };
      });
    },

    /** 创建订单 */
    async create(orderData) {
      const sb = getSB();
      if (!sb) return { data: null, error: new Error('Supabase not available') };

      // 获取当前用户
      const { data: { session } } = await sb.auth.getSession();
      const userId = session?.user?.id;

      const newOrder = {
        pl_number: generatePLNumber(),
        customer_name: orderData.customer_name,
        customer_id: orderData.customer_id || null,
        design_pattern: orderData.design_pattern || '',
        design_code: orderData.design_code || '',
        quantity: parseFloat(orderData.quantity) || 0,
        unit: orderData.unit || 'm',
        order_date: orderData.order_date || new Date().toISOString().split('T')[0],
        delivery_date: orderData.delivery_date || null,
        status: '设计',
        progress: 0,
        factory_id: orderData.factory_id || null,
        factory_name: orderData.factory_name || '',
        price: parseFloat(orderData.price) || null,
        currency: orderData.currency || 'USD',
        total_amount: parseFloat(orderData.total_amount) || null,
        notes: orderData.notes || '',
        created_by: userId,
        assigned_to: orderData.assigned_to || userId
      };

      const { data, error } = await sb.from('orders').insert(newOrder).select().single();

      if (!error && data) {
        // 创建初始阶段记录
        await sb.from('order_steps').insert({
          order_id: data.id,
          step_name: '设计',
          progress: 0,
          status: 'in_progress'
        });

        // 记录操作日志
        await logs.create('create_order', 'orders', data.id, { pl_number: data.pl_number });
      }

      return { data, error };
    },

    /** 更新订单 */
    async update(orderId, updates) {
      const sb = getSB();
      if (!sb) return { data: null, error: new Error('Supabase not available') };

      updates.updated_at = new Date().toISOString();

      // 自动计算是否延期
      if (updates.delivery_date && updates.status && !['已完成','已取消','出货'].includes(updates.status)) {
        const delivery = new Date(updates.delivery_date);
        const today = new Date();
        if (delivery < today) {
          updates.is_delayed = true;
          updates.delay_days = Math.ceil((today - delivery) / (1000 * 60 * 60 * 24));
        } else {
          updates.is_delayed = false;
          updates.delay_days = 0;
        }
      }

      const { data, error } = await sb.from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

      if (!error) {
        await logs.create('update_order', 'orders', orderId, updates);
      }

      return { data, error };
    },

    /** 更新订单状态/进度 */
    async updateStatus(orderId, newStatus, progress) {
      const updates = { status: newStatus, updated_at: new Date().toISOString() };
      if (progress !== undefined) updates.progress = progress;

      const result = await orders.update(orderId, updates);

      if (!result.error) {
        // 更新或创建阶段记录
        const sb = getSB();
        if (sb) {
          const { data: existingStep } = await sb.from('order_steps')
            .select('id')
            .eq('order_id', orderId)
            .eq('step_name', newStatus)
            .single();

          if (existingStep) {
            await sb.from('order_steps')
              .update({ progress: progress || 0, status: 'in_progress' })
              .eq('id', existingStep.id);
          } else {
            await sb.from('order_steps')
              .insert({ order_id: orderId, step_name: newStatus, progress: progress || 0, status: 'in_progress' });
          }
        }
      }

      return result;
    },

    /** 删除订单 */
    async delete(orderId) {
      const sb = getSB();
      if (!sb) return { error: new Error('Supabase not available') };
      await logs.create('delete_order', 'orders', orderId, {});
      return sb.from('orders').delete().eq('id', orderId);
    }
  };

  // ======================== 客户模块 ========================

  const customers = {
    async list(filters = {}) {
      return safeQuery(async (sb) => {
        let query = sb.from('customers').select('*').order('name');
        if (filters.search) query = query.ilike('name', `%${filters.search}%`);
        if (filters.country) query = query.eq('country', filters.country);
        return query;
      }, []);
    },

    async getById(id) {
      return safeQuery(async (sb) => sb.from('customers').select('*').eq('id', id).single());
    },

    async create(data) {
      const sb = getSB();
      if (!sb) return { data: null, error: new Error('Supabase not available') };
      const { data: result, error } = await sb.from('customers').insert(data).select().single();
      if (!error) await logs.create('create_customer', 'customers', result.id, { name: data.name });
      return { data: result, error };
    },

    async update(id, data) {
      const sb = getSB();
      if (!sb) return { data: null, error: new Error('Supabase not available') };
      data.updated_at = new Date().toISOString();
      return sb.from('customers').update(data).eq('id', id).select().single();
    }
  };

  // ======================== 工厂模块 ========================

  const factories = {
    async list(filters = {}) {
      return safeQuery(async (sb) => {
        let query = sb.from('factories').select('*').order('name');
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.search) query = query.ilike('name', `%${filters.search}%`);
        return query;
      }, []);
    },

    async getById(id) {
      return safeQuery(async (sb) => sb.from('factories').select('*').eq('id', id).single());
    },

    async create(data) {
      const sb = getSB();
      if (!sb) return { data: null, error: new Error('Supabase not available') };
      const { data: result, error } = await sb.from('factories').insert(data).select().single();
      if (!error) await logs.create('create_factory', 'factories', result.id, { name: data.name });
      return { data: result, error };
    },

    async update(id, data) {
      const sb = getSB();
      if (!sb) return { data: null, error: new Error('Supabase not available') };
      data.updated_at = new Date().toISOString();
      return sb.from('factories').update(data).eq('id', id).select().single();
    },

    async updateRating(id, rating) {
      return factories.update(id, { rating });
    }
  };

  // ======================== 财务模块 ========================

  const finance = {
    /** 回款列表 */
    async listPayments(filters = {}) {
      return safeQuery(async (sb) => {
        let query = sb.from('finance_payments').select(`
          *,
          order:orders(pl_number, customer_name),
          verifier:profiles!finance_payments_verified_by_fkey(name)
        `).order('payment_date', { ascending: false });

        if (filters.orderId) query = query.eq('order_id', filters.orderId);
        if (filters.verified !== undefined) query = query.eq('verified', filters.verified);
        if (filters.currency) query = query.eq('currency', filters.currency);

        return query;
      }, []);
    },

    /** 核销回款 */
    async verifyPayment(paymentId) {
      const sb = getSB();
      if (!sb) return { error: new Error('Supabase not available') };
      const { data: { session } } = await sb.auth.getSession();

      const result = await sb.from('finance_payments')
        .update({
          verified: true,
          verified_by: session?.user?.id,
          verified_at: new Date().toISOString()
        })
        .eq('id', paymentId)
        .select()
        .single();

      if (!result.error) {
        await logs.create('verify_payment', 'finance_payments', paymentId, {});
        // 发送通知
        await notifications.create({
          user_id: session?.user?.id,
          title: '回款核销成功',
          message: `回款记录 #${paymentId.slice(0,8)} 已核销`,
          type: 'payment_alert'
        });
      }

      return result;
    },

    /** 费用列表 */
    async listExpenses(filters = {}) {
      return safeQuery(async (sb) => {
        let query = sb.from('finance_expenses').select(`
          *,
          order:orders(pl_number, customer_name)
        `).order('expense_date', { ascending: false });

        if (filters.orderId) query = query.eq('order_id', filters.orderId);
        if (filters.category) query = query.eq('category', filters.category);

        return query;
      }, []);
    },

    /** 创建费用记录 */
    async addExpense(data) {
      const sb = getSB();
      if (!sb) return { data: null, error: new Error('Supabase not available') };
      return sb.from('finance_expenses').insert(data).select().single();
    },

    /** 利润分析 */
    async getProfitAnalysis(orderId) {
      return safeQuery(async (sb) => {
        // 收入
        const { data: payments } = await sb.from('finance_payments')
          .select('amount, currency')
          .eq('order_id', orderId)
          .eq('verified', true);

        // 支出
        const { data: expenses } = await sb.from('finance_expenses')
          .select('amount, currency, category')
          .eq('order_id', orderId);

        // 订单信息
        const { data: order } = await sb.from('orders')
          .select('total_amount, currency')
          .eq('id', orderId)
          .single();

        const totalIncome = (payments || []).reduce((s, p) => s + parseFloat(p.amount), 0);
        const totalExpense = (expenses || []).reduce((s, e) => s + parseFloat(e.amount), 0);
        const expectedIncome = parseFloat(order?.total_amount) || 0;

        return {
          data: {
            orderId,
            expectedIncome,
            totalIncome,
            totalExpense,
            profit: totalIncome - totalExpense,
            profitMargin: expectedIncome > 0 ? ((totalIncome - totalExpense) / expectedIncome * 100).toFixed(1) : 0,
            payments: payments || [],
            expenses: expenses || []
          }
        };
      });
    },

    /** 汇率管理 */
    async getRates() {
      const cached = getCache('exchange_rates');
      const result = await safeQuery(async (sb) =>
        sb.from('finance_rates').select('*').order('from_currency')
      );
      if (!result.fromFallback && result.data) setCache('exchange_rates', result.data);
      return result.data || cached || [];
    },

    async updateRate(id, rate) {
      const sb = getSB();
      if (!sb) return { error: new Error('Supabase not available') };
      return sb.from('finance_rates')
        .update({ rate, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    },

    async createRate(data) {
      const sb = getSB();
      if (!sb) return { data: null, error: new Error('Supabase not available') };
      return sb.from('finance_rates').insert(data).select().single();
    }
  };

  // ======================== 文件模块 ========================

  const files = {
    async upload(file, folder, onProgress) {
      if (window.SupabaseStorage) {
        return window.SupabaseStorage.uploadFile(file, folder, onProgress);
      }
      return { success: false, error: 'SupabaseStorage not available' };
    },

    async listByOrder(orderId) {
      return safeQuery(async (sb) =>
        sb.from('order_files').select('*').eq('order_id', orderId).order('created_at', { ascending: false })
      , []);
    },

    async attachToOrder(orderId, fileInfo) {
      const sb = getSB();
      if (!sb) return { error: new Error('Supabase not available') };
      return sb.from('order_files').insert({
        order_id: orderId,
        ...fileInfo
      }).select().single();
    },

    async remove(fileId) {
      const sb = getSB();
      if (!sb) return { error: new Error('Supabase not available') };
      // 先获取文件信息
      const { data: fileInfo } = await sb.from('order_files').select('file_path').eq('id', fileId).single();
      // 从 Storage 删除
      if (fileInfo?.file_path && window.SupabaseStorage) {
        await window.SupabaseStorage.deleteFile(fileInfo.file_path);
      }
      // 从数据库删除记录
      return sb.from('order_files').delete().eq('id', fileId);
    }
  };

  // ======================== 通知模块 ========================

  const notifications = {
    async list(limit = 50) {
      const sb = getSB();
      if (!sb) return { data: [], error: new Error('Supabase not available') };
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user?.id) return { data: [], error: null };

      return safeQuery(async (s) =>
        s.from('notifications')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(limit)
      , []);
    },

    async getUnreadCount() {
      const sb = getSB();
      if (!sb) return 0;
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user?.id) return 0;

      const { count } = await sb.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('read', false);
      return count || 0;
    },

    async markRead(notificationId) {
      const sb = getSB();
      if (!sb) return;
      await sb.from('notifications').update({ read: true }).eq('id', notificationId);
    },

    async markAllRead() {
      const sb = getSB();
      if (!sb) return;
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user?.id) return;
      await sb.from('notifications')
        .update({ read: true })
        .eq('user_id', session.user.id)
        .eq('read', false);
    },

    async create({ user_id, title, message, type, related_order_id }) {
      const sb = getSB();
      if (!sb) return;
      return sb.from('notifications').insert({
        user_id,
        title,
        message,
        type: type || 'info',
        related_order_id
      });
    }
  };

  // ======================== 日志模块 ========================

  const logs = {
    async list(limit = 100) {
      return safeQuery(async (sb) =>
        sb.from('operation_logs')
          .select('*, user:profiles(name)')
          .order('created_at', { ascending: false })
          .limit(limit)
      , []);
    },

    async create(action, targetType, targetId, details = {}) {
      const sb = getSB();
      if (!sb) return;
      const { data: { session } } = await sb.auth.getSession();
      return sb.from('operation_logs').insert({
        user_id: session?.user?.id,
        action,
        target_type: targetType,
        target_id: targetId,
        details
      });
    }
  };

  // ======================== 用户模块 ========================

  const users = {
    async getProfile() {
      const sb = getSB();
      if (!sb) {
        // 回退到 localStorage
        try { return JSON.parse(localStorage.getItem('currentUser')); } catch { return null; }
      }
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user?.id) return null;

      const { data } = await sb.from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      return data;
    },

    async updateProfile(updates) {
      const sb = getSB();
      if (!sb) return { error: new Error('Supabase not available') };
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user?.id) return { error: new Error('Not logged in') };

      updates.updated_at = new Date().toISOString();
      return sb.from('profiles').update(updates).eq('id', session.user.id);
    },

    async list() {
      return safeQuery(async (sb) =>
        sb.from('profiles').select('*').order('name')
      , []);
    },

    async updateRole(userId, role) {
      const sb = getSB();
      if (!sb) return { error: new Error('Supabase not available') };
      const result = await sb.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', userId);
      if (!result.error) {
        await logs.create('update_user_role', 'profiles', userId, { role });
      }
      return result;
    },

    /** 检查手机号是否已被注册 */
    async checkPhoneUnique(phone) {
      if (!phone) return { exists: false };
      // 先检查 Supabase
      const sb = getSB();
      if (sb) {
        try {
          const { data, error } = await sb.from('profiles')
            .select('id')
            .eq('phone', phone)
            .single();
          if (data) return { exists: true };
          if (error && error.code !== 'PGRST116') {
            console.warn('⚠️ 手机号查询失败:', error.message);
          }
        } catch (e) { /* profiles 表可能不存在 */ }
      }
      // 回退到 localStorage
      const localUsers = JSON.parse(localStorage.getItem('adminUsers') || '[]');
      const exists = localUsers.some(u => u.phone === phone);
      return { exists };
    }
  };

  // ======================== 仪表盘统计 ========================

  const dashboard = {
    async getStats() {
      const sb = getSB();
      if (!sb) return {
        data: { total: 0, processing: 0, delayed: 0, pendingPayment: 0, completed: 0 }
      };

      try {
        const { count: total } = await sb.from('orders').select('id', { count: 'exact', head: true });
        const { count: processing } = await sb.from('orders').select('id', { count: 'exact', head: true })
          .not('status', 'in', '("已完成","已取消")');
        const { count: delayed } = await sb.from('orders').select('id', { count: 'exact', head: true })
          .eq('is_delayed', true);
        const { count: pendingPayment } = await sb.from('finance_payments')
          .select('id', { count: 'exact', head: true }).eq('verified', false);
        const { count: completed } = await sb.from('orders')
          .select('id', { count: 'exact', head: true }).eq('status', '已完成');

        return { data: {
          total: total || 0,
          processing: processing || 0,
          delayed: delayed || 0,
          pendingPayment: pendingPayment || 0,
          completed: completed || 0
        }};
      } catch (e) {
        console.warn('⚠️ 统计查询失败:', e.message);
        return { data: { total: 0, processing: 0, delayed: 0, pendingPayment: 0, completed: 0 } };
      }
    },

    async getRecentOrders(limit = 10) {
      return safeQuery(async (sb) =>
        sb.from('orders')
          .select('id, pl_number, customer_name, design_pattern, quantity, unit, status, progress, is_delayed, delay_days, updated_at')
          .order('updated_at', { ascending: false })
          .limit(limit)
      , []);
    },

    async getOverdueOrders() {
      return safeQuery(async (sb) =>
        sb.from('orders')
          .select('id, pl_number, customer_name, delivery_date, delay_days, status')
          .eq('is_delayed', true)
          .order('delay_days', { ascending: false })
      , []);
    }
  };

  // ======================== 询价模块 ========================

  const inquiries = {
    async list(filters = {}) {
      return safeQuery(async (sb) => {
        let query = sb.from('inquiries').select('*').order('created_at', { ascending: false });
        if (filters.status) query = query.eq('status', filters.status);
        return query;
      }, []);
    },

    async create(data) {
      const sb = getSB();
      if (!sb) return { data: null, error: new Error('Supabase not available') };
      const { data: { session } } = await sb.auth.getSession();
      data.created_by = session?.user?.id;
      data.inquiry_number = 'INQ-' + Date.now();
      const { data: result, error } = await sb.from('inquiries').insert(data).select().single();
      if (!error) await logs.create('create_inquiry', 'inquiries', result.id, { inquiry_number: result.inquiry_number });
      return { data: result, error };
    },

    async update(id, data) {
      const sb = getSB();
      if (!sb) return { data: null, error: new Error('Supabase not available') };
      data.updated_at = new Date().toISOString();
      return sb.from('inquiries').update(data).eq('id', id).select().single();
    }
  };

  // ======================== 设计生产模块 ========================

  const designProductions = {
    async getByOrder(orderId) {
      return safeQuery(async (sb) =>
        sb.from('design_productions').select('*').eq('order_id', orderId).single()
      );
    },

    async update(id, data) {
      const sb = getSB();
      if (!sb) return { error: new Error('Supabase not available') };
      data.updated_at = new Date().toISOString();
      return sb.from('design_productions').update(data).eq('id', id);
    }
  };

  // ======================== 唛头库模块 ========================

  const markLibrary = {
    async list() {
      return safeQuery(async (sb) =>
        sb.from('mark_library').select('*').order('mark_code')
      , []);
    },

    async create(data) {
      const sb = getSB();
      if (!sb) return { data: null, error: new Error('Supabase not available') };
      return sb.from('mark_library').insert(data).select().single();
    },

    async remove(id) {
      const sb = getSB();
      if (!sb) return { error: new Error('Supabase not available') };
      return sb.from('mark_library').delete().eq('id', id);
    }
  };

  // ======================== 装柜模块 ========================

  const loadingPlans = {
    async listByOrder(orderId) {
      return safeQuery(async (sb) =>
        sb.from('loading_plans').select('*').eq('order_id', orderId).order('created_at', { ascending: false })
      , []);
    },

    async create(data) {
      const sb = getSB();
      if (!sb) return { data: null, error: new Error('Supabase not available') };
      return sb.from('loading_plans').insert(data).select().single();
    },

    async update(id, data) {
      const sb = getSB();
      if (!sb) return { error: new Error('Supabase not available') };
      data.updated_at = new Date().toISOString();
      return sb.from('loading_plans').update(data).eq('id', id);
    }
  };

  // ======================== 单证模块 ========================

  const docs = {
    async listByOrder(orderId) {
      return safeQuery(async (sb) =>
        sb.from('documents').select('*').eq('order_id', orderId).order('created_at', { ascending: false })
      , []);
    },

    async create(data) {
      const sb = getSB();
      if (!sb) return { data: null, error: new Error('Supabase not available') };
      return sb.from('documents').insert(data).select().single();
    },

    async update(id, data) {
      const sb = getSB();
      if (!sb) return { error: new Error('Supabase not available') };
      data.updated_at = new Date().toISOString();
      return sb.from('documents').update(data).eq('id', id);
    }
  };

  // ======================== 任务模块 ========================

  const tasks = {
    async list(filters = {}) {
      const sb = getSB();
      if (!sb) return { data: [], error: new Error('Supabase not available') };
      const { data: { session } } = await sb.auth.getSession();

      return safeQuery(async (s) => {
        let query = s.from('tasks')
          .select('*, order:orders(pl_number, customer_name), assignee:profiles!tasks_assignee_id_fkey(name)')
          .order('created_at', { ascending: false });

        if (filters.assigneeId) query = query.eq('assignee_id', filters.assigneeId);
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.priority) query = query.eq('priority', filters.priority);
        if (filters.myTasks && session?.user?.id) query = query.eq('assignee_id', session.user.id);

        return query;
      }, []);
    },

    async create(data) {
      const sb = getSB();
      if (!sb) return { data: null, error: new Error('Supabase not available') };
      const { data: { session } } = await sb.auth.getSession();
      data.created_by = session?.user?.id;
      return sb.from('tasks').insert(data).select().single();
    },

    async update(id, data) {
      const sb = getSB();
      if (!sb) return { error: new Error('Supabase not available') };
      data.updated_at = new Date().toISOString();
      if (data.status === 'completed') data.completed_at = new Date().toISOString();
      return sb.from('tasks').update(data).eq('id', id).select().single();
    },

    async complete(id) {
      return tasks.update(id, { status: 'completed' });
    }
  };

  // ======================== 公开 API ========================

  const api = {
    orders,
    customers,
    factories,
    finance,
    files,
    notifications,
    logs,
    users,
    dashboard,
    inquiries,
    designProductions,
    markLibrary,
    loadingPlans,
    docs,
    tasks,

    /** 检查后端是否可用 */
    isBackendAvailable() {
      return getSB() !== null;
    },

    /** 测试所有模块连通性 */
    async testConnection() {
      if (window.SupabaseClient && window.SupabaseClient.testConnection) {
        return window.SupabaseClient.testConnection();
      }
      const result = await safeQuery(async (sb) => {
        const { data } = await sb.from('profiles').select('id').limit(1);
        return { data, error: null };
      });
      return { success: !result.fromFallback, error: result.error?.message };
    }
  };

  console.log('✅ DataService 模块已加载（17个业务模块）');
  return api;
})();

// 挂载到全局
window.DataService = DataService;
