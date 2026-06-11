/**
 * 捷隆纺织 - 全局UI组件库
 * 包含 Toast、Modal、Loading、骨架屏等组件
 */

// Toast通知组件
const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      `;
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'success', duration = 3000) {
    this.init();
    
    const toast = document.createElement('div');
    const bgColors = {
      success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      info: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
    };
    const icons = {
      success: 'fa-check-circle',
      error: 'fa-times-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };

    toast.innerHTML = `
      <div style="
        background: ${bgColors[type]};
        color: white;
        padding: 14px 20px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        font-weight: 500;
        pointer-events: auto;
        animation: slideIn 0.3s ease;
        min-width: 250px;
        max-width: 350px;
      ">
        <i class="fas ${icons[type]}" style="font-size: 18px;"></i>
        <span style="flex: 1;">${message}</span>
        <button onclick="this.parentElement.remove()" style="
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 4px;
          opacity: 0.8;
        ">
          <i class="fas fa-times" style="font-size: 14px;"></i>
        </button>
      </div>
    `;

    this.container.appendChild(toast);

    // 自动消失
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);

    // 添加动画样式
    if (!document.getElementById('toast-animations')) {
      const style = document.createElement('style');
      style.id = 'toast-animations';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  },

  success(message) { this.show(message, 'success', 2000); },
  error(message) { this.show(message, 'error', 3000); },
  warning(message) { this.show(message, 'warning', 3000); },
  info(message) { this.show(message, 'info', 3000); }
};

// 确认对话框组件
const ConfirmModal = {
  show(options) {
    const { title, message, confirmText = '确认', cancelText = '取消', onConfirm, onCancel, type = 'warning' } = options;
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: fadeIn 0.2s ease;
    `;

    const colors = {
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6'
    };

    overlay.innerHTML = `
      <div style="
        background: white;
        border-radius: 16px;
        padding: 24px;
        width: 100%;
        max-width: 340px;
        animation: scaleIn 0.2s ease;
      ">
        <div style="
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: ${colors[type]}20;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        ">
          <i class="fas fa-${type === 'danger' ? 'exclamation-triangle' : type === 'info' ? 'info-circle' : 'exclamation-circle'}" style="font-size: 24px; color: ${colors[type]};"></i>
        </div>
        <h3 style="font-size: 18px; font-weight: 600; color: #1f2937; margin: 0 0 12px 0;">${title}</h3>
        <p style="font-size: 14px; color: #6b7280; margin: 0 0 24px 0; line-height: 1.5;">${message}</p>
        <div style="display: flex; gap: 12px;">
          <button id="modal-cancel" style="
            flex: 1;
            padding: 12px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid #e5e7eb;
            background: white;
            color: #374151;
          ">${cancelText}</button>
          <button id="modal-confirm" style="
            flex: 1;
            padding: 12px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            border: none;
            background: ${colors[type]};
            color: white;
          ">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => {
      overlay.style.animation = 'fadeOut 0.2s ease forwards';
      setTimeout(() => overlay.remove(), 200);
    };

    overlay.querySelector('#modal-cancel').onclick = () => {
      closeModal();
      if (onCancel) onCancel();
    };

    overlay.querySelector('#modal-confirm').onclick = () => {
      closeModal();
      if (onConfirm) onConfirm();
    };

    overlay.onclick = (e) => {
      if (e.target === overlay) closeModal();
    };

    // 添加动画样式
    if (!document.getElementById('modal-animations')) {
      const style = document.createElement('style');
      style.id = 'modal-animations';
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    // ESC键关闭
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }
};

// Loading加载组件
const Loading = {
  show(message = '加载中...') {
    if (document.getElementById('global-loading')) return;
    
    const loading = document.createElement('div');
    loading.id = 'global-loading';
    loading.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.6);
      z-index: 10002;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
    `;

    loading.innerHTML = `
      <div style="
        width: 50px;
        height: 50px;
        border: 4px solid rgba(255,255,255,0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      "></div>
      <p style="color: white; font-size: 14px; font-weight: 500;">${message}</p>
    `;

    document.body.appendChild(loading);

    // 添加旋转动画
    if (!document.getElementById('loading-animations')) {
      const style = document.createElement('style');
      style.id = 'loading-animations';
      style.textContent = `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  },

  hide() {
    const loading = document.getElementById('global-loading');
    if (loading) loading.remove();
  }
};

// 骨架屏组件
const Skeleton = {
  show(targetElement, type = 'card') {
    const skeletonHTML = {
      card: `
        <div class="skeleton-card" style="
          background: white;
          border-radius: 12px;
          padding: 16px;
          margin: 12px;
          animation: pulse 1.5s ease-in-out infinite;
        ">
          <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
            <div style="width: 120px; height: 20px; background: #e5e7eb; border-radius: 4px;"></div>
            <div style="width: 80px; height: 24px; background: #e5e7eb; border-radius: 6px;"></div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px;">
            <div style="height: 16px; background: #e5e7eb; border-radius: 4px;"></div>
            <div style="height: 16px; background: #e5e7eb; border-radius: 4px;"></div>
            <div style="height: 16px; background: #e5e7eb; border-radius: 4px;"></div>
            <div style="height: 16px; background: #e5e7eb; border-radius: 4px;"></div>
          </div>
          <div style="height: 8px; background: #e5e7eb; border-radius: 4px;"></div>
        </div>
      `,
      table: `
        <div class="skeleton-table" style="
          background: white;
          padding: 16px;
          animation: pulse 1.5s ease-in-out infinite;
        ">
          <div style="display: flex; gap: 20px; padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
            ${Array(5).fill('<div style="flex: 1; height: 16px; background: #e5e7eb; border-radius: 4px;"></div>').join('')}
          </div>
          ${Array(5).fill(`
            <div style="display: flex; gap: 20px; padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
              ${Array(5).fill('<div style="flex: 1; height: 14px; background: #f3f4f6; border-radius: 4px;"></div>').join('')}
            </div>
          `).join('')}
        </div>
      `
    };

    targetElement.innerHTML = skeletonHTML[type] + skeletonHTML[type]; // 2个骨架屏

    // 添加动画
    if (!document.getElementById('skeleton-animations')) {
      const style = document.createElement('style');
      style.id = 'skeleton-animations';
      style.textContent = `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `;
      document.head.appendChild(style);
    }
  },

  hide(targetElement) {
    // 移除骨架屏，显示实际内容
    targetElement.querySelectorAll('.skeleton-card, .skeleton-table').forEach(el => el.remove());
  }
};

// 网络状态提示
const NetworkStatus = {
  init() {
    const banner = document.createElement('div');
    banner.id = 'network-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #f59e0b;
      color: white;
      text-align: center;
      padding: 10px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10003;
      display: none;
      align-items: center;
      justify-content: center;
      gap: 8px;
    `;
    banner.innerHTML = '<i class="fas fa-wifi" style="font-size: 16px;"></i> 网络连接已断开，部分功能不可用';
    document.body.appendChild(banner);

    // 初始检测：如果 navigator.onLine 是 false，再显示
    if (!navigator.onLine) {
      banner.style.display = 'flex';
    }

    window.addEventListener('online', function() {
      banner.style.display = 'none';
    });

    window.addEventListener('offline', function() {
      banner.style.display = 'flex';
    });
  }
};

// 表单验证工具
const FormValidator = {
  rules: {
    required: (value) => value && value.trim() !== '',
    positiveNumber: (value) => !value || (!isNaN(parseFloat(value)) && parseFloat(value) > 0),
    email: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    phone: (value) => !value || /^1[3-9]\d{9}$/.test(value),
    date: (value) => !value || !isNaN(Date.parse(value))
  },

  messages: {
    required: '此字段为必填项',
    positiveNumber: '请输入正数',
    email: '请输入有效的邮箱地址',
    phone: '请输入有效的手机号码',
    date: '请输入有效的日期'
  },

  validate(formElement) {
    let isValid = true;
    const errors = [];

    // 清除之前的错误
    formElement.querySelectorAll('.form-error').forEach(el => el.remove());
    formElement.querySelectorAll('.error').forEach(el => el.classList.remove('error'));

    // 验证所有带 required 类的输入框
    formElement.querySelectorAll('[required]').forEach(input => {
      if (!this.rules.required(input.value)) {
        isValid = false;
        errors.push({ field: input, message: this.messages.required });
        input.classList.add('error');
        
        // 添加错误提示
        const errorDiv = document.createElement('div');
        errorDiv.className = 'form-error';
        errorDiv.style.cssText = 'color: #ef4444; font-size: 12px; margin-top: 4px;';
        errorDiv.textContent = this.messages.required;
        input.parentElement.appendChild(errorDiv);
      }
    });

    // 验证带 custom-validate 类的输入框
    formElement.querySelectorAll('[data-validate]').forEach(input => {
      const validateRules = input.dataset.validate.split(',');
      validateRules.forEach(rule => {
        if (!this.rules[rule](input.value)) {
          isValid = false;
          errors.push({ field: input, message: this.messages[rule] || '验证失败' });
          input.classList.add('error');
          
          const errorDiv = document.createElement('div');
          errorDiv.className = 'form-error';
          errorDiv.style.cssText = 'color: #ef4444; font-size: 12px; margin-top: 4px;';
          errorDiv.textContent = this.messages[rule] || '验证失败';
          if (!input.parentElement.querySelector('.form-error')) {
            input.parentElement.appendChild(errorDiv);
          }
        }
      });
    });

    return { isValid, errors };
  }
};

// 文件上传工具
const FileUpload = {
  showProgress(file, onProgress, onComplete, onError) {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        if (onComplete) onComplete(file);
      } else {
        if (onProgress) onProgress(progress);
      }
    }, 500);
  }
};

// 导出到Excel
const ExportExcel = {
  download(data, filename) {
    // 简单的CSV导出
    const csv = this.convertToCSV(data);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    Toast.success('导出成功');
  },

  convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(row => 
      headers.map(header => {
        let cell = row[header] || '';
        // 处理包含逗号或引号的单元格
        if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
          cell = '"' + cell.replace(/"/g, '""') + '"';
        }
        return cell;
      }).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  }
};

// 导出全局对象
window.Toast = Toast;
window.ConfirmModal = ConfirmModal;
window.Loading = Loading;
window.Skeleton = Skeleton;
window.NetworkStatus = NetworkStatus;
window.FormValidator = FormValidator;
window.FileUpload = FileUpload;
window.ExportExcel = ExportExcel;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  NetworkStatus.init();
});
