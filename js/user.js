// 用户信息管理模块
// 确保所有页面都从同一个数据源获取用户信息

const UserManager = {
  // 角色中文名映射
  ROLE_NAMES: {
    'super_admin': '超级管理员',
    'follow_up_manager': '跟单主管',
    'follow_up_staff': '跟单员',
    'finance_manager': '财务主管',
    'finance_assistant': '财务助理',
    'boss': '老板'
  },

  // 默认用户信息
  DEFAULT_USER: {
    name: '张三',
    role: 'follow_up_staff',
    email: 'zhangsan@example.com'
  },

  // 获取当前用户信息
  getCurrentUser() {
    try {
      const localData = localStorage.getItem('currentUser');
      if (localData) {
        return JSON.parse(localData);
      }
    } catch (e) {
      console.warn('从 localStorage 读取用户信息失败:', e);
    }
    return this.DEFAULT_USER;
  },

  // 设置当前用户信息
  setCurrentUser(user) {
    try {
      const userData = { ...this.DEFAULT_USER, ...user };
      localStorage.setItem('currentUser', JSON.stringify(userData));
      console.log('✅ 用户信息已保存:', userData);
      return userData;
    } catch (e) {
      console.error('保存用户信息失败:', e);
      return null;
    }
  },

  // 获取用户角色中文名
  getRoleName(role) {
    return this.ROLE_NAMES[role] || role || '未知角色';
  },

  // 更新用户信息到页面
  updateUserDisplay() {
    const user = this.getCurrentUser();
    
    // 更新头像（取名字第一个字）
    const avatar = document.getElementById('profileAvatar') || document.querySelector('.avatar');
    if (avatar) {
      avatar.textContent = user.name.charAt(0).toUpperCase();
    }
    
    // 更新姓名
    const nameElement = document.getElementById('profileName') || document.querySelector('.user-name');
    if (nameElement) {
      nameElement.textContent = user.name;
    }
    
    // 更新角色
    const roleElement = document.getElementById('profileRole') || document.querySelector('.user-role');
    if (roleElement) {
      roleElement.textContent = this.getRoleName(user.role);
    }
    
    // 更新邮箱
    const emailElement = document.getElementById('profileEmail') || document.querySelector('.user-email');
    if (emailElement) {
      emailElement.textContent = user.email;
    }
    
    console.log('✅ 页面用户信息已更新:', user);
    return user;
  },

  // 检查是否是管理员
  isAdmin() {
    const user = this.getCurrentUser();
    return user.role === 'super_admin' || user.role === 'boss';
  },

  // 检查是否是跟单相关角色
  isFollowUpRole() {
    const user = this.getCurrentUser();
    return user.role === 'follow_up_staff' || user.role === 'follow_up_manager';
  },

  // 检查是否是财务相关角色
  isFinanceRole() {
    const user = this.getCurrentUser();
    return user.role === 'finance_staff' || user.role === 'finance_manager';
  }
};

// 暴露到全局
window.UserManager = UserManager;

// 页面加载时自动更新用户显示
document.addEventListener('DOMContentLoaded', function() {
  UserManager.updateUserDisplay();
});