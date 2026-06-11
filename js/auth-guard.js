// 认证守卫模块
const AuthGuard = {
  // 需要认证的页面列表
  protectedPages: [
    'pages/dashboard.html',
    'pages/order-detail.html',
    'pages/admin-users.html',
    'pages/settings.html',
    'pages/history.html',
    'pages/finance.html',
    'pages/files.html'
  ],
  
  // 公开页面（不需要认证）
  publicPages: [
    'pages/login.html',
    'pages/register.html',
    'index.html'
  ],
  
  // 检查用户是否已登录
  isLoggedIn() {
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) {
      return false;
    }
    
    try {
      const user = JSON.parse(currentUser);
      // 检查用户数据是否完整
      return !!(user && user.id && user.email);
    } catch (error) {
      console.error('❌ 解析用户数据失败:', error);
      return false;
    }
  },
  
  // 获取当前用户
  getCurrentUser() {
    if (!this.isLoggedIn()) {
      return null;
    }
    
    try {
      return JSON.parse(localStorage.getItem('currentUser'));
    } catch (error) {
      console.error('❌ 获取当前用户失败:', error);
      return null;
    }
  },
  
  // 检查用户权限
  hasPermission(requiredRole) {
    const user = this.getCurrentUser();
    if (!user) {
      return false;
    }
    
    // 角色权限等级
    const roleLevels = {
      '超级管理员': 100,
      '跟单主管': 80,
      '财务主管': 80,
      '跟单员': 50,
      '财务助理': 40,
      '老板': 90
    };
    
    const userLevel = roleLevels[user.role] || 0;
    const requiredLevel = roleLevels[requiredRole] || 0;
    
    return userLevel >= requiredLevel;
  },
  
  // 检查页面访问权限
  canAccessPage(pagePath) {
    const user = this.getCurrentUser();
    if (!user) {
      return false;
    }
    
    // 管理员页面需要超级管理员权限
    if (pagePath.includes('admin-users.html')) {
      return user.role === '超级管理员';
    }
    
    // 财务页面需要财务相关权限
    if (pagePath.includes('finance.html')) {
      return ['超级管理员', '财务主管', '财务助理', '老板'].includes(user.role);
    }
    
    return true;
  },
  
  // 路由守卫
  guard() {
    const currentPath = window.location.pathname;
    const currentPage = currentPath.split('/').pop();
    
    console.log('🔒 路由守卫检查:', currentPage);
    console.log('📍 当前页面:', currentPath);
    
    // 如果是公开页面，允许访问
    if (this.publicPages.some(page => currentPath.includes(page))) {
      console.log('✅ 公开页面，允许访问');
      return true;
    }
    
    // 如果是受保护页面，检查登录状态
    if (this.protectedPages.some(page => currentPath.includes(page))) {
      if (!this.isLoggedIn()) {
        console.log('❌ 未登录，跳转到登录页');
        this.redirectToLogin();
        return false;
      }
      
      // 检查页面访问权限
      if (!this.canAccessPage(currentPath)) {
        console.log('❌ 无权限访问该页面');
        this.showAccessDenied();
        return false;
      }
      
      console.log('✅ 已登录且有权限，允许访问');
      return true;
    }
    
    console.log('⚠️ 未知页面，允许访问');
    return true;
  },
  
  // 跳转到登录页
  redirectToLogin() {
    const currentPath = window.location.pathname;
    // 保存当前页面URL，登录后可以跳回
    sessionStorage.setItem('redirectAfterLogin', currentPath);
    
    // 使用绝对路径跳转到登录页
    window.location.pathname = '/pages/login.html';
  },
  
  // 显示权限拒绝
  showAccessDenied() {
    alert('您没有权限访问该页面，请联系管理员');
    window.location.href = 'pages/dashboard.html';
  },
  
  // 登录
  async login(email, password) {
    try {
      // 这里应该调用 Supabase Auth 进行真正的登录
      // 暂时使用模拟登录
      const users = JSON.parse(localStorage.getItem('adminUsers') || '[]');
      const user = users.find(u => u.email === email);
      
      if (user && user.password === password) {
        const userData = {
          id: user.id || Date.now(),
          email: user.email,
          username: user.username,
          role: user.role,
          avatar: user.avatar,
          lastLogin: new Date().toISOString()
        };
        
        localStorage.setItem('currentUser', JSON.stringify(userData));
        localStorage.setItem('isLoggedIn', 'true');
        
        console.log('✅ 登录成功:', userData);
        return { success: true, user: userData };
      } else {
        return { success: false, error: '账号或密码错误' };
      }
    } catch (error) {
      console.error('❌ 登录失败:', error);
      return { success: false, error: '登录失败，请稍后重试' };
    }
  },
  
  // 登出
  logout() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('redirectAfterLogin');
    console.log('✅ 已登出');
    window.location.href = 'pages/login.html';
  },
  
  // 登录后跳转
  redirectAfterLogin() {
    const redirectPath = sessionStorage.getItem('redirectAfterLogin');
    sessionStorage.removeItem('redirectAfterLogin');
    
    // 如果有重定向路径且不是公开页面
    if (redirectPath && !this.publicPages.some(page => redirectPath.includes(page))) {
      // 如果重定向路径已经包含完整的路径，直接使用
      if (redirectPath.startsWith('/')) {
        // 移除开头的斜杠，从当前位置跳转
        window.location.href = redirectPath.substring(1);
      } else {
        window.location.href = redirectPath;
      }
    } else {
      // 默认跳转到dashboard
      window.location.href = 'dashboard.html';
    }
  },
  
  // 初始化路由守卫
  init() {
    console.log('🔒 初始化路由守卫');
    this.guard();
    
    // 监听页面可见性变化，重新检查认证
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.guard();
      }
    });
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthGuard;
}

// 页面加载时自动初始化路由守卫
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    AuthGuard.init();
  });
}