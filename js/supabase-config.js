// Supabase 配置文件
// 项目 URL: https://uujlzxidillcvqjxmqnj.supabase.co

window.SupabaseConfig = {
  // 【已配置】您的 Supabase 项目 URL
  URL: 'https://uujlzxidillcvqjxmqnj.supabase.co',
  
  // 【已配置】您的 Supabase 项目 API Key（anon/public key）
  API_KEY: 'sb_publishable_x0Do8yWb3XA5Asr1x0Bd7Q_HfDMgIl6',
  
  // 存储桶名称（需要在 Supabase 中预先创建）
  STORAGE_BUCKET: 'documents',
  
  // 数据表名称
  TABLES: {
    USERS: 'users',
    ORDERS: 'orders',
    TASKS: 'tasks',
    NOTIFICATIONS: 'notifications'
  },
  
  // 认证配置
  AUTH: {
    AUTO_REFRESH_TOKEN: true,
    PERSIST_SESSION: true,
    DETECT_SESSION_IN_URL: true
  }
};

// 快速配置说明：
// 1. 登录 https://app.supabase.com
// 2. 创建或选择您的项目
// 3. 进入 Settings -> API
// 4. 复制 Project URL 和 anon/public API Key
// 5. 替换上面的 URL 和 API_KEY
// 6. 在 Storage 中创建名为 "documents" 的存储桶
// 7. 在 SQL Editor 中运行初始化脚本创建必要的表

console.log('📋 SupabaseConfig loaded');
console.log('🔗 Current URL:', window.SupabaseConfig.URL);
