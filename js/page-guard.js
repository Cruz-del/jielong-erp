/**
 * 页面路由守卫 - 防止直接URL访问绕过权限
 * 页面必须在主框架(index.html)的iframe中加载，否则重定向到首页
 */
(function() {
  // 公开页面（允许直接访问）
  var publicPages = ['login.html', 'index.html', 'register.html'];
  var currentPage = location.pathname.split('/').pop() || '';

  // 公开页面不拦截
  for (var i = 0; i < publicPages.length; i++) {
    if (currentPage === publicPages[i]) return;
  }

  // 检查是否在 iframe 中
  var isInIframe = (window.parent && window.parent !== window);

  if (!isInIframe) {
    // 直接URL访问 → 重定向到主入口
    location.replace('../index.html');
  }
})();
