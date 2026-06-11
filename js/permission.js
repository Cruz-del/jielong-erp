/**
 * 权限管理系统
 * 支持多层级权限模型：角色定义、数据权限、字段权限
 */

const PermissionSystem = (function() {
  // 角色定义
  const ROLES = {
    SUPER_ADMIN: 'super_admin',
    FOLLOW_UP_SUPERVISOR: 'follow_up_supervisor',
    FOLLOW_UP_STAFF: 'follow_up_staff',
    FINANCE_SUPERVISOR: 'finance_supervisor',
    FINANCE_ASSISTANT: 'finance_assistant',
    BOSS: 'boss'
  };

  // 角色权限配置
  const ROLE_PERMISSIONS = {
    [ROLES.SUPER_ADMIN]: {
      name: '超级管理员',
      permissions: ['*'],
      dataAccess: 'all',
      hiddenFields: []
    },
    [ROLES.FOLLOW_UP_SUPERVISOR]: {
      name: '跟单主管',
      permissions: [
        'view_all_orders', 'audit_abnormal', 'assign_factory',
        'view_team_orders', 'edit_order', 'create_order',
        'upload_documents', 'view_finance_summary'
      ],
      dataAccess: 'team',
      hiddenFields: ['cost_price', 'bank_account']
    },
    [ROLES.FOLLOW_UP_STAFF]: {
      name: '跟单员',
      permissions: [
        'view_my_orders', 'edit_order', 'upload_documents',
        'report_abnormal', 'view_finance_summary'
      ],
      dataAccess: 'own',
      hiddenFields: ['cost_price', 'bank_account']
    },
    [ROLES.FINANCE_SUPERVISOR]: {
      name: '财务主管',
      permissions: [
        'view_all_finance', 'verify_payment', 'view_all_orders',
        'export_finance_data', 'view_profit_report'
      ],
      dataAccess: 'all',
      hiddenFields: ['factory_contact', 'cost_price']
    },
    [ROLES.FINANCE_ASSISTANT]: {
      name: '财务助理',
      permissions: [
        'view_finance', 'enter_invoice', 'enter_water_bill',
        'view_orders'
      ],
      dataAccess: 'all',
      hiddenFields: ['factory_contact', 'cost_price', 'verify_payment']
    },
    [ROLES.BOSS]: {
      name: '老板',
      permissions: [
        'view_all_dashboards', 'view_profit_report',
        'view_summary', 'export_summary'
      ],
      dataAccess: 'all',
      hiddenFields: ['cost_price', 'bank_account', 'factory_contact']
    }
  };

  // 当前用户信息
  let currentUser = null;

  return {
    ROLES,
    ROLE_PERMISSIONS,

    // 初始化用户权限
    init(user) {
      currentUser = user || this._loadCurrentUser();
      if (!currentUser) {
        // 默认使用跟单员权限
        currentUser = {
          id: 'guest',
          name: '访客',
          role: ROLES.FOLLOW_UP_STAFF,
          department: 'A组',
          team: '跟单一组'
        };
      }
      return currentUser;
    },

    // 获取当前用户
    getCurrentUser() {
      return currentUser;
    },

    // 获取用户角色配置
    getRoleConfig(role) {
      return ROLE_PERMISSIONS[role] || {};
    },

    // 检查权限
    hasPermission(permission) {
      if (!currentUser) return false;
      
      const config = ROLE_PERMISSIONS[currentUser.role];
      if (!config) return false;
      
      // 超级管理员拥有所有权限
      if (config.permissions.includes('*')) return true;
      
      return config.permissions.includes(permission);
    },

    // 检查多个权限（全部满足）
    hasPermissions(permissions) {
      return permissions.every(p => this.hasPermission(p));
    },

    // 检查数据访问权限
    canAccessData(dataOwnerId) {
      if (!currentUser) return false;
      
      const config = ROLE_PERMISSIONS[currentUser.role];
      if (!config) return false;
      
      // 全部访问权限
      if (config.dataAccess === 'all') return true;
      
      // 团队访问权限
      if (config.dataAccess === 'team') {
        // 简化实现：假设数据带有团队信息
        return true;
      }
      
      // 仅自己的数据
      if (config.dataAccess === 'own') {
        return dataOwnerId === currentUser.id;
      }
      
      return false;
    },

    // 获取隐藏字段列表
    getHiddenFields() {
      if (!currentUser) return [];
      
      const config = ROLE_PERMISSIONS[currentUser.role];
      return config ? config.hiddenFields : [];
    },

    // 检查字段是否可见
    canViewField(fieldName) {
      const hiddenFields = this.getHiddenFields();
      return !hiddenFields.includes(fieldName);
    },

    // 过滤数据中的隐藏字段
    filterDataByPermissions(data) {
      if (!data || typeof data !== 'object') return data;
      
      const hiddenFields = this.getHiddenFields();
      const filtered = { ...data };
      
      hiddenFields.forEach(field => {
        if (field in filtered) {
          filtered[field] = '***';
        }
      });
      
      return filtered;
    },

    // 获取可用权限列表（用于权限配置）
    getAllPermissions() {
      const allPermissions = new Set();
      
      Object.values(ROLE_PERMISSIONS).forEach(role => {
        role.permissions.forEach(perm => {
          if (perm !== '*') {
            allPermissions.add(perm);
          }
        });
      });
      
      return Array.from(allPermissions);
    },

    // 保存当前用户到localStorage
    saveUser(user) {
      currentUser = user;
      localStorage.setItem('currentUser', JSON.stringify(user));
    },

    // 加载当前用户
    _loadCurrentUser() {
      try {
        const saved = localStorage.getItem('currentUser');
        return saved ? JSON.parse(saved) : null;
      } catch (e) {
        return null;
      }
    },

    // 获取角色名称
    getRoleName(role) {
      const config = ROLE_PERMISSIONS[role];
      return config ? config.name : role;
    },

    // 获取当前用户角色名称
    getCurrentRoleName() {
      return this.getRoleName(currentUser?.role || '');
    }
  };
})();

/**
 * 操作日志系统
 * 记录所有关键操作，保留时间≥180天
 */
const AuditLog = (function() {
  const LOG_TYPES = {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    EXPORT: 'export',
    IMPORT: 'import',
    LOGIN: 'login',
    LOGOUT: 'logout',
    PERMISSION_CHANGE: 'permission_change',
    EXCHANGE_RATE_UPDATE: 'exchange_rate_update',
    PAYMENT_VERIFY: 'payment_verify'
  };

  const MAX_RETENTION_DAYS = 180;

  return {
    LOG_TYPES,

    // 添加日志
    add(type, details) {
      const log = {
        id: Date.now().toString(),
        type,
        userId: PermissionSystem.getCurrentUser()?.id || 'unknown',
        userName: PermissionSystem.getCurrentUser()?.name || '未知用户',
        timestamp: new Date().toISOString(),
        details: typeof details === 'string' ? details : JSON.stringify(details)
      };

      const logs = this._getLogs();
      logs.unshift(log);
      
      // 清理过期日志
      this._cleanOldLogs(logs);
      
      localStorage.setItem('auditLogs', JSON.stringify(logs));
    },

    // 获取日志列表
    getLogs(filter = {}) {
      const logs = this._getLogs();
      
      let filtered = logs;
      
      // 按类型筛选
      if (filter.type) {
        filtered = filtered.filter(log => log.type === filter.type);
      }
      
      // 按时间范围筛选
      if (filter.startDate) {
        filtered = filtered.filter(log => log.timestamp >= filter.startDate);
      }
      if (filter.endDate) {
        filtered = filtered.filter(log => log.timestamp <= filter.endDate);
      }
      
      // 按用户筛选
      if (filter.userId) {
        filtered = filtered.filter(log => log.userId === filter.userId);
      }
      
      return filtered;
    },

    // 获取日志详情
    getLog(id) {
      const logs = this._getLogs();
      return logs.find(log => log.id === id);
    },

    // 获取日志类型名称
    getLogTypeName(type) {
      const names = {
        [LOG_TYPES.CREATE]: '创建',
        [LOG_TYPES.UPDATE]: '修改',
        [LOG_TYPES.DELETE]: '删除',
        [LOG_TYPES.EXPORT]: '导出',
        [LOG_TYPES.IMPORT]: '导入',
        [LOG_TYPES.LOGIN]: '登录',
        [LOG_TYPES.LOGOUT]: '登出',
        [LOG_TYPES.PERMISSION_CHANGE]: '权限变更',
        [LOG_TYPES.EXCHANGE_RATE_UPDATE]: '汇率更新',
        [LOG_TYPES.PAYMENT_VERIFY]: '回款核销'
      };
      return names[type] || type;
    },

    // 获取所有日志类型
    getAllLogTypes() {
      return Object.entries(LOG_TYPES).map(([key, value]) => ({
        value,
        label: this.getLogTypeName(value),
        key
      }));
    },

    // 清理过期日志
    _cleanOldLogs(logs) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - MAX_RETENTION_DAYS);
      const cutoffTimestamp = cutoffDate.toISOString();
      
      return logs.filter(log => log.timestamp >= cutoffTimestamp);
    },

    // 获取所有日志
    _getLogs() {
      try {
        const saved = localStorage.getItem('auditLogs');
        const logs = saved ? JSON.parse(saved) : [];
        return this._cleanOldLogs(logs);
      } catch (e) {
        return [];
      }
    },

    // 导出日志
    exportLogs() {
      const logs = this.getLogs();
      const csv = this._logsToCSV(logs);
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 记录导出操作
      this.add(LOG_TYPES.EXPORT, `导出日志 ${logs.length} 条`);
    },

    // 转换为CSV格式
    _logsToCSV(logs) {
      const headers = ['ID', '类型', '用户ID', '用户名', '时间', '详情'];
      const rows = logs.map(log => [
        log.id,
        this.getLogTypeName(log.type),
        log.userId,
        log.userName,
        new Date(log.timestamp).toLocaleString('zh-CN'),
        `"${log.details}"`
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
  };
})();

/**
 * 数据加密工具（用于敏感数据存储）
 */
const Encryption = (function() {
  const SECRET_KEY = 'jielong_textile_2026_encryption_key'; // 实际项目中应从环境变量获取

  return {
    // 加密数据
    encrypt(data) {
      if (!data) return data;
      
      try {
        let encrypted = '';
        for (let i = 0; i < data.length; i++) {
          const charCode = data.charCodeAt(i);
          const keyCode = SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
          encrypted += String.fromCharCode(charCode ^ keyCode);
        }
        return btoa(encrypted);
      } catch (e) {
        console.error('Encryption error:', e);
        return data;
      }
    },

    // 解密数据
    decrypt(encryptedData) {
      if (!encryptedData) return encryptedData;
      
      try {
        const decoded = atob(encryptedData);
        let decrypted = '';
        for (let i = 0; i < decoded.length; i++) {
          const charCode = decoded.charCodeAt(i);
          const keyCode = SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
          decrypted += String.fromCharCode(charCode ^ keyCode);
        }
        return decrypted;
      } catch (e) {
        console.error('Decryption error:', e);
        return encryptedData;
      }
    },

    // 加密对象中的敏感字段
    encryptSensitiveFields(data, sensitiveFields = ['phone', 'bankAccount', 'bankCard']) {
      if (!data || typeof data !== 'object') return data;
      
      const result = { ...data };
      sensitiveFields.forEach(field => {
        if (result[field]) {
          result[field] = this.encrypt(result[field]);
        }
      });
      
      return result;
    },

    // 解密对象中的敏感字段
    decryptSensitiveFields(data, sensitiveFields = ['phone', 'bankAccount', 'bankCard']) {
      if (!data || typeof data !== 'object') return data;
      
      const result = { ...data };
      sensitiveFields.forEach(field => {
        if (result[field]) {
          result[field] = this.decrypt(result[field]);
        }
      });
      
      return result;
    }
  };
})();

// 导出到全局
window.PermissionSystem = PermissionSystem;
window.AuditLog = AuditLog;
window.Encryption = Encryption;
