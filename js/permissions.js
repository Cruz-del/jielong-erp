/**
 * 捷隆纺织 - 前端权限模块 v2
 * 7个标准角色，精确控制：底部Tab可见性、功能卡片可见性、节点编辑权限、数据范围
 */
const Permission = (function() {
  'use strict';

  // ============ 7角色定义 ============
  // tabs: 哪些底部Tab不可见（空=全部可见）
  // editNodes: 哪些节点可编辑
  // hiddenCards: 哪些功能卡片不可见（空=全部可见）
  // dataScope: 数据隔离范围

  const ROLES = {
    '超级管理员': {
      hiddenTabs: [],
      editNodes: ['01','02','03','04','05','06','07','08','09','10'],
      hiddenCards: [],
      dataScope: 'all'
    },
    '外贸业务员': {
      hiddenTabs: ['财务','驾驶舱','管理'],
      editNodes: ['01','02','03','04','05','06','07','08'],
      hiddenCards: ['应收看板','回款核销','利润分析','汇率管理','订单对账','风险预警','海外仓',
                    '老板看板','工厂绩效','客户贡献',
                    '用户管理','权限管理','批量操作','操作日志'],
      dataScope: 'own'
    },
    '设计师': {
      hiddenTabs: ['财务','驾驶舱','管理'],
      editNodes: ['03'],
      hiddenCards: ['应收看板','回款核销','利润分析','汇率管理','订单对账','风险预警','海外仓',
                    '装柜管理','报关单证','计划单','询价管理',
                    'AI对话','单据识别','预警通知',
                    '老板看板','工厂绩效','客户贡献',
                    '用户管理','权限管理','批量操作','操作日志'],
      dataScope: 'assigned'
    },
    '工厂管理员': {
      hiddenTabs: ['财务','AI助手','物流单证','驾驶舱','管理'],
      editNodes: ['04'],
      hiddenCards: ['应收看板','回款核销','利润分析','汇率管理','订单对账','风险预警','海外仓',
                    '装柜管理','报关单证','文件中心','计划单','询价管理','设计生产','唛头库',
                    'AI对话','单据识别','预警通知',
                    '老板看板','工厂绩效','客户贡献',
                    '用户管理','权限管理','批量操作','操作日志'],
      dataScope: 'factory'
    },
    'QC质检员': {
      hiddenTabs: ['财务','AI助手','物流单证','驾驶舱','管理'],
      editNodes: ['05'],
      hiddenCards: ['应收看板','回款核销','利润分析','汇率管理','订单对账','风险预警','海外仓',
                    '装柜管理','报关单证','文件中心','计划单','询价管理','设计生产','唛头库','工厂档案',
                    'AI对话','单据识别','预警通知',
                    '老板看板','工厂绩效','客户贡献',
                    '用户管理','权限管理','批量操作','操作日志'],
      dataScope: 'assigned'
    },
    '物流员': {
      hiddenTabs: ['财务','AI助手','驾驶舱','管理'],
      editNodes: ['06','07','08'],
      hiddenCards: ['应收看板','回款核销','利润分析','汇率管理','订单对账','风险预警','海外仓',
                    '计划单','询价管理','设计生产','唛头库','工厂档案',
                    'AI对话','单据识别','预警通知',
                    '老板看板','工厂绩效','客户贡献',
                    '用户管理','权限管理','批量操作','操作日志'],
      dataScope: 'qc_passed'
    },
    '财务人员': {
      hiddenTabs: ['驾驶舱','管理'],
      editNodes: ['09'],
      hiddenCards: ['计划单','询价管理','设计生产','唛头库','工厂档案','装柜管理','报关单证','文件中心',
                    'AI对话','单据识别',
                    '老板看板','工厂绩效','客户贡献',
                    '用户管理','权限管理','批量操作','操作日志','待办任务'],
      dataScope: 'shipped'
    }
  };

  // 所有可用的底部Tab（用于可见性判断）
  const ALL_TABS = ['工作台','物流单证','财务','AI助手','驾驶舱','管理'];

  let cachedRole = null;

  function getMyRole() {
    if (cachedRole) return cachedRole;
    try {
      const user = JSON.parse(sessionStorage.getItem('currentUser'));
      if (user && user.role) { cachedRole = user.role; return cachedRole; }
    } catch(e) {}
    return '外贸业务员'; // 默认最低权限
  }

  async function refresh() {
    cachedRole = null;
    // 从 Supabase 重新拉取最新角色
    if (window.SupabaseClient && window.SupabaseClient.isAvailable()) {
      try {
        var sb = window.SupabaseClient.getInstance();
        var { data: { session } } = await sb.auth.getSession();
        if (session && session.user) {
          var { data: profile } = await sb.from('profiles').select('role').eq('id', session.user.id).single();
          if (profile && profile.role) {
            cachedRole = profile.role;
            // 同步到 sessionStorage
            try {
              var user = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
              user.role = profile.role;
              sessionStorage.setItem('currentUser', JSON.stringify(user));
            } catch(e) {}
            console.log('Permission.refresh: role updated to', cachedRole);
            return cachedRole;
          }
        }
      } catch(e) { console.warn('Permission refresh failed:', e.message); }
    }
    return getMyRole();
  }

  // ============ 公开 API ============

  /** 是否能看到某个底部Tab */
  function canSeeTab(tabName) {
    if (tabName === '通知' || tabName === '我的') return true; // 所有人可见
    const role = getMyRole();
    const def = ROLES[role];
    if (!def) return true;
    return !def.hiddenTabs.includes(tabName);
  }

  /** 是否能看到某个功能卡片 */
  function canSeeCard(cardName) {
    const role = getMyRole();
    const def = ROLES[role];
    if (!def) return true;
    return !def.hiddenCards.includes(cardName);
  }

  /** 是否能编辑某个节点 */
  function canEditNode(nodeId) {
    const role = getMyRole();
    const def = ROLES[role];
    if (!def) return false;
    return def.editNodes.includes(nodeId);
  }

  /** 是否能删除订单 */
  function canDeleteOrder() { return getMyRole() === '超级管理员'; }

  /** 是否能管理用户 */
  function canManageUsers() { return getMyRole() === '超级管理员'; }

  /** 数据隔离范围 */
  function getDataScope() {
    const def = ROLES[getMyRole()];
    return def ? def.dataScope : 'own';
  }

  /** 是否是管理员 */
  function isAdmin() { return getMyRole() === '超级管理员'; }

  /** 获取角色定义信息 */
  function getRoleInfo(roleName) { return ROLES[roleName] || null; }

  /** 所有可用角色名 */
  function getAllRoles() { return Object.keys(ROLES); }

  console.log('🔐 权限模块v2已加载, 角色:', getMyRole());
  return { getMyRole, refresh, canSeeTab, canSeeCard, canEditNode, canDeleteOrder, canManageUsers, getDataScope, isAdmin, getRoleInfo, getAllRoles };
})();
window.Permission = Permission;
