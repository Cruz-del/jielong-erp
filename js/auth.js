/**
 * 捷隆纺织 - 认证模块 v2
 * 结合 Supabase Auth 和本地回退的混合认证方案
 */

const Auth = {
  /**
   * 检查是否已登录
   * 优先检查 Supabase Session，回退到 localStorage
   */
  async isLoggedIn() {
    // 优先检查 Supabase Session
    if (window.SupabaseClient && window.SupabaseClient.isAvailable()) {
      try {
        const { data: { session } } = await window.SupabaseClient.getSession();
        if (session?.user) {
          // 同步更新 localStorage 以确保兼容性
          this.syncLocalStorage(session.user);
          return true;
        }
      } catch (e) {
        console.warn('⚠️ Supabase session check failed:', e.message);
      }
    }
    // 回退到 localStorage
    return sessionStorage.getItem('isLoggedIn') === 'true' && !!sessionStorage.getItem('currentUser');
  },

  /**
   * 同步检查（同步版本，用于路由守卫等场景）
   */
  isLoggedInSync() {
    return sessionStorage.getItem('isLoggedIn') === 'true' && !!sessionStorage.getItem('currentUser');
  },

  /**
   * 获取当前用户
   */
  async getUser() {
    // 优先从 Supabase 获取
    if (window.SupabaseClient && window.SupabaseClient.isAvailable()) {
      try {
        const { data: { session } } = await window.SupabaseClient.getSession();
        if (session?.user) {
          // 尝试从 profiles 表获取完整信息
          try {
            const { data: profile } = await window.SupabaseClient.getInstance()
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            if (profile) return { ...session.user, ...profile, username: profile.name };
          } catch (e) { /* profiles 表可能不存在 */ }
          return { ...session.user, username: session.user.email };
        }
      } catch (e) { /* 忽略 */ }
    }
    // 回退到 localStorage
    try {
      return JSON.parse(sessionStorage.getItem('currentUser'));
    } catch { return null; }
  },

  /**
   * 同步获取用户（同步版本）
   */
  getUserSync() {
    try {
      return JSON.parse(sessionStorage.getItem('currentUser'));
    } catch { return null; }
  },

  /**
   * 登录（使用 Supabase）
   */
  async login(email, password) {
    // 尝试 Supabase 登录
    if (window.SupabaseClient && window.SupabaseClient.isAvailable()) {
      const { data, error } = await window.SupabaseClient.signIn(email, password);
      if (!error && data.session) {
        const userInfo = await this.fetchUserProfile(data.session.user);
        this.saveToSession(userInfo);
        console.log('✅ Supabase 登录成功:', userInfo.username);
        return { success: true, user: userInfo, method: 'supabase' };
      }
    }

    // 回退到本地登录
    const localUsers = JSON.parse(localStorage.getItem('adminUsers') || '[]');
    const localUser = localUsers.find(u => u.email === email && u.password === password);
    if (localUser) {
      // 尝试从 Supabase profiles 获取最新角色
      var role = localUser.role || '跟单员';
      if (window.SupabaseClient && window.SupabaseClient.isAvailable()) {
        try {
          var sb = window.SupabaseClient.getInstance();
          var { data: profile } = await sb.from('profiles').select('role,name').eq('email', email).single();
          if (profile && profile.role) role = profile.role;
        } catch(e) { /* profiles 表可能不存在 */ }
      }
      const userInfo = {
        id: localUser.id || Date.now(),
        email: localUser.email,
        username: localUser.username || localUser.name || email,
        role: role,
        avatar: localUser.avatar || null,
        lastLogin: new Date().toISOString()
      };
      this.saveToSession(userInfo);
      console.log('✅ 本地登录成功, 角色:', role);
      return { success: true, user: userInfo, method: 'local' };
    }

    return { success: false, error: '账号或密码错误' };
  },

  /**
   * 登出
   */
  async logout() {
    // Supabase 登出
    if (window.SupabaseClient && window.SupabaseClient.isAvailable()) {
      try { await window.SupabaseClient.signOut(); } catch (e) { /* 忽略 */ }
    }
    // 清除本地存储
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('loginTime');
    console.log('✅ 已退出登录');
  },

  /**
   * 注册
   */
  async register(name, email, password, phone) {
    if (password.length < 6) {
      return { success: false, error: '密码至少需要6位' };
    }

    // 尝试 Supabase 注册
    if (window.SupabaseClient && window.SupabaseClient.isAvailable()) {
      const { data, error } = await window.SupabaseClient.signUp(email, password);
      if (!error && data.user) {
        // 保存用户档案到 profiles 表（包含手机号）
        try {
          const sb = window.SupabaseClient.getInstance();
          await sb.from('profiles').upsert({
            id: data.user.id,
            name,
            email,
            phone: phone || null,
            role: '跟单员'
          });
        } catch (e) { console.warn('⚠️ 用户档案创建失败:', e.message); }

        // 同时保存到本地
        const users = JSON.parse(localStorage.getItem('adminUsers') || '[]');
        users.push({ id: data.user.id, email, phone, username: name, password, role: '跟单员' });
        localStorage.setItem('adminUsers', JSON.stringify(users));

        return { success: true, user: data.user, method: 'supabase' };
      }
      if (error) return { success: false, error: error.message };
    }

    // 回退到本地注册
    const users = JSON.parse(localStorage.getItem('adminUsers') || '[]');
    if (users.find(u => u.email === email)) {
      return { success: false, error: '该邮箱已注册' };
    }
    if (phone && users.find(u => u.phone === phone)) {
      return { success: false, error: '该手机号已被注册' };
    }
    const newUser = { id: Date.now(), email, phone, username: name, password, role: '跟单员' };
    users.push(newUser);
    localStorage.setItem('adminUsers', JSON.stringify(users));
    return { success: true, user: newUser, method: 'local' };
  },

  // ---- 内部工具 ----

  /** 从 profiles 表获取用户完整信息 */
  async fetchUserProfile(supabaseUser) {
    try {
      const sb = window.SupabaseClient.getInstance();
      const { data: profile } = await sb.from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();
      return {
        id: supabaseUser.id,
        email: supabaseUser.email,
        username: profile?.name || supabaseUser.email,
        role: profile?.role || '跟单员',
        avatar: profile?.avatar || null,
        phone: profile?.phone || null,
        lastLogin: new Date().toISOString()
      };
    } catch {
      return {
        id: supabaseUser.id,
        email: supabaseUser.email,
        username: supabaseUser.email,
        role: '跟单员',
        avatar: null,
        lastLogin: new Date().toISOString()
      };
    }
  },

  /** 保存用户信息到 sessionStorage（浏览器关闭后自动清除） */
  saveToSession(userInfo) {
    sessionStorage.setItem('currentUser', JSON.stringify(userInfo));
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('loginTime', Date.now().toString());
  },

  /** 同步 Supabase session 到 localStorage */
  syncLocalStorage(supabaseUser) {
    if (!sessionStorage.getItem('isLoggedIn')) {
      const userInfo = {
        id: supabaseUser.id,
        email: supabaseUser.email,
        username: supabaseUser.user_metadata?.name || supabaseUser.email,
        role: supabaseUser.user_metadata?.role || '跟单员',
        lastLogin: new Date().toISOString()
      };
      this.saveToSession(userInfo);
    }
  }
};

// 挂载到全局
window.Auth = Auth;
console.log('🔐 Auth v2 模块已加载');
