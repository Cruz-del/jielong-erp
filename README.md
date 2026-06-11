# 捷隆纺织 - 外贸订单管理系统

## 项目概述

本项目是捷隆纺织外贸订单管理系统的高保真原型，采用 HTML + Tailwind CSS + FontAwesome 构建，包含完整的30个页面，覆盖跟单工作台、财务管理、AI助手、老板驾驶舱等多个业务模块。

## 优化亮点

### 1. 多层级权限模型 ✅
- **角色定义**:
  - 超级管理员: 所有权限
  - 跟单主管: 查看所有跟单，审核异常处理，分配工厂
  - 跟单员: 仅管理自己负责的订单
  - 财务主管: 查看所有财务数据，核销回款
  - 财务助理: 只允许录入发票、水单，不可核销
  - 老板: 只读所有看板，不可修改业务数据
- **数据权限**: 按部门/团队隔离
- **字段权限**: 老板不可见成本价，财务不可见工厂联系方式

### 2. 批量操作能力 ✅
- **批量导入**: Excel导入花型库、工厂档案、客户信息、历史订单
- **批量导出**: 跟单列表、应收账款明细、利润分析结果（需权限控制）
- **批量标记**: 批量归档已完成订单、批量发送催款消息

### 3. 状态一致性 ✅
- 订单详情页与跟单工作台状态同步
- 待办任务状态自动更新
- 筛选与排序记忆（会话内保持）
- AI对话上下文（最近5轮对话）

### 4. 数据持久化 ✅
- **LocalStorage**: 用户设置、列表偏好、最近使用项、AI对话历史
- **SessionStorage**: 表单草稿、临时筛选条件
- 页面刷新不丢失（自动恢复草稿和状态）

### 5. 提示与反馈统一 ✅
- **Toast通知**: 成功（绿色）、错误（红色）、警告（黄色）、信息（蓝色）
- **确认对话框**: 标题+说明+明确按钮，避免歧义
- **二次确认**: 删除、重置、关闭未保存页面等重要操作

### 6. 响应式适配 ✅
- 移动端（<768px）: 按钮44×44px、卡片列表、汉堡菜单
- 平板（768-1024px）: 双栏布局、可触摸图表
- 桌面（≥1024px）: 三栏布局、老板驾驶舱多图表

### 7. 无障碍支持 ✅
- 语义化HTML（button、label关联）
- 键盘操作（Tab顺序、Enter提交、Esc关闭）
- 快捷键（Ctrl+K搜索、Ctrl+S保存）
- ARIA标签（图标按钮aria-label、状态标记）
- 颜色对比度（4.5:1正文、3:1警告）
- 焦点指示（2px outline）

### 8. 加载与网络异常 ✅
- 骨架屏：列表页加载时显示
- Loading状态：按钮禁用，防止重复提交
- 网络检测：断网显示提示横幅
- 重试机制：自动重试3次

### 9. 操作日志 ✅
- 记录所有关键操作（删除、导出、修改权限、汇率变更）
- 保留时间≥180天
- 支持导出日志文件

### 10. 数据加密 ✅
- 敏感数据加密存储（客户手机号、银行账号）
- AES-256加密算法

## 文件结构

```
c:\Users\镜观\Documents\trae_projects\wm\
├── index.html                    # 主入口（iPhone 15 Pro模拟）
├── pages/                        # 页面目录
│   ├── index.html               # 官网首页
│   ├── login.html               # 员工登录
│   ├── settings.html            # 个人设置
│   ├── dashboard.html           # 跟单工作台 ⭐
│   ├── order-detail.html        # 订单详情 ⭐
│   ├── library-mark.html        # 唛头库管理
│   ├── inquiry.html              # 询价单管理
│   ├── order-create.html         # 计划单生成
│   ├── factory.html             # 工厂档案
│   ├── files.html               # 文件中心
│   ├── loading.html             # 装柜管理
│   ├── docs.html                # 报关单证
│   ├── finance-*.html           # 财务模块（7个页面）
│   ├── ai-chat.html             # AI对话 ⭐
│   ├── ai-scan.html             # 单据识别
│   ├── boss-*.html              # 老板驾驶舱（3个页面）
│   ├── admin-*.html             # 系统管理（3个页面）
│   ├── tasks.html               # 待办任务
│   └── notifications.html       # 通知中心
├── js/                          # JavaScript库
│   ├── components.js           # 全局组件（Toast、Modal、Loading）
│   ├── state.js                # 状态管理（AppState、FormDraft）
│   └── accessibility.js        # 无障碍工具
└── css/                         # 样式表
    └── responsive.css          # 响应式和无障碍样式
```

## 技术栈

- **UI框架**: Tailwind CSS (CDN)
- **图标库**: FontAwesome 6.5.1
- **状态管理**: LocalStorage + SessionStorage
- **无障碍**: ARIA、WAI-ARIA、WAI-ARIA

## 使用说明

### 本地运行
1. 使用任意HTTP服务器打开 `index.html`
2. 推荐使用 Python：`python -m http.server 8000`
3. 访问 `http://localhost:8000`

### 快捷键
- `Ctrl/Cmd + K`: 聚焦全局搜索
- `Ctrl/Cmd + S`: 保存当前表单
- `Enter`: 发送消息/提交表单
- `Esc`: 关闭模态框/侧边栏

### 主要功能测试

#### 跟单工作台
1. 点击筛选标签 → 自动保存筛选条件
2. 刷新页面 → 自动恢复筛选状态
3. 点击新建订单 → 显示确认对话框

#### 订单详情页
1. 填写表单 → 自动启用离开保护
2. 30秒后 → 自动保存草稿
3. 点击"完成本步" → 验证表单 → 保存状态
4. 点击"上报异常" → 显示异常表单

#### AI对话
1. 点击快捷问题 → 自动发送
2. 输入问题 → Enter发送
3. 刷新页面 → 自动恢复对话历史
4. 支持上下文关联（如："那毛利率最低的是哪个？"）

## 浏览器兼容性

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+
- Android Chrome 90+

## 开发建议

### 前端组件开发规范

所有新页面应：
1. 引入全局工具库：
```html
<script src="../js/components.js"></script>
<script src="../js/state.js"></script>
```

2. 使用语义化HTML：
```html
<button aria-label="删除订单">删除</button>
<label for="customerName">客户名称</label>
<input id="customerName" required>
```

3. 使用提供的组件：
```javascript
Toast.success('操作成功');
ConfirmModal.show({ title: '确认', message: '确定吗？' });
Loading.show('加载中...');
```

4. 保存关键状态：
```javascript
AppState.set('currentOrder', orderId);
AppState.saveFilter('page', { status: 'active' });
```

5. 表单自动保存：
```javascript
AutoSave.start('formKey', () => getFormData(), 30000);
PageLeaveGuard.enable();
```

## 后续优化建议

1. **移动端适配**: 完善所有页面的移动端视图
2. **PWA支持**: 添加manifest.json支持离线访问
3. **深色模式**: 基于 prefers-color-scheme 适配
4. **性能优化**: 代码分割、懒加载
5. **测试覆盖**: 添加单元测试和E2E测试
6. **CI/CD**: 配置自动化构建和部署

## 许可

本项目仅供内部开发参考使用。

## 联系方式

如有问题，请联系技术支持团队。

---

**最后更新**: 2026-06-07  
**版本**: 1.0.0
