-- ============================================================
-- 捷隆纺织 - 权限系统 SQL v2（7角色 + 数据隔离 + 操作日志）
-- 在 Supabase SQL Editor 中执行：全选 → Run
-- ============================================================

-- ====== 1. 修复 profiles 角色约束 ======
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (
  role IN ('超级管理员','外贸业务员','设计师','工厂管理员','QC质检员','物流员','财务人员','跟单主管','跟单员')
);

-- ====== 2. 补充缺失字段 ======
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT '外贸业务员';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS factory_id UUID;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- ====== 3. 权限辅助函数 ======
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS VARCHAR AS $$
  SELECT COALESCE((SELECT role FROM profiles WHERE id = auth.uid()), '外贸业务员');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT get_my_role() = '超级管理员';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ====== 4. 删除所有旧策略（避免重复创建报错） ======
DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname='public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- ====== 5. profiles 表 RLS ======
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY p1 ON profiles FOR SELECT USING (true);  -- 所有人可读
CREATE POLICY p2 ON profiles FOR UPDATE USING (auth.uid() = id);  -- 只能改自己

-- ====== 6. orders 表 RLS（数据隔离核心） ======
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 6.1 管理员看全部
CREATE POLICY orders_read_admin ON orders FOR SELECT USING (is_admin());
-- 6.2 自己创建的
CREATE POLICY orders_read_own ON orders FOR SELECT USING (auth.uid() = created_by);
-- 6.3 分配给自己的
CREATE POLICY orders_read_assigned ON orders FOR SELECT USING (auth.uid() = assigned_to);

-- 6.4 插入：管理员 + 业务员
CREATE POLICY orders_insert ON orders FOR INSERT
  WITH CHECK (get_my_role() IN ('超级管理员','外贸业务员'));

-- 6.5 更新：管理员 + 创建者 + 被分配者
CREATE POLICY orders_update ON orders FOR UPDATE
  USING (is_admin() OR auth.uid() = created_by OR auth.uid() = assigned_to);

-- 6.6 删除：仅超级管理员
CREATE POLICY orders_delete ON orders FOR DELETE USING (is_admin());

-- ====== 7. 财务表 RLS ======
ALTER TABLE finance_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY fp_read ON finance_payments FOR SELECT
  USING (get_my_role() IN ('超级管理员','财务人员') OR auth.uid() = created_by);
CREATE POLICY fp_write ON finance_payments FOR INSERT
  WITH CHECK (get_my_role() IN ('超级管理员','财务人员'));
CREATE POLICY fp_update ON finance_payments FOR UPDATE
  USING (get_my_role() IN ('超级管理员','财务人员'));

ALTER TABLE finance_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY fe_read ON finance_expenses FOR SELECT
  USING (get_my_role() IN ('超级管理员','财务人员'));
CREATE POLICY fe_write ON finance_expenses FOR INSERT
  WITH CHECK (get_my_role() IN ('超级管理员','财务人员'));

ALTER TABLE finance_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY fr_read ON finance_rates FOR SELECT USING (true);
CREATE POLICY fr_write ON finance_rates FOR ALL
  USING (get_my_role() IN ('超级管理员','财务人员'));

-- ====== 8. 客户/工厂 RLS ======
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY cust_read ON customers FOR SELECT USING (true);
CREATE POLICY cust_write ON customers FOR INSERT
  WITH CHECK (get_my_role() IN ('超级管理员','外贸业务员'));

ALTER TABLE factories ENABLE ROW LEVEL SECURITY;
CREATE POLICY fact_read ON factories FOR SELECT USING (true);
CREATE POLICY fact_write ON factories FOR INSERT
  WITH CHECK (get_my_role() IN ('超级管理员','外贸业务员'));

-- ====== 9. 任务表 RLS ======
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY t_read ON tasks FOR SELECT
  USING (auth.uid() = assignee_id OR auth.uid() = created_by OR is_admin());
CREATE POLICY t_insert ON tasks FOR INSERT WITH CHECK (true);
CREATE POLICY t_update ON tasks FOR UPDATE
  USING (auth.uid() = assignee_id OR is_admin());

-- ====== 10. 操作日志 RLS ======
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY log_read ON operation_logs FOR SELECT USING (true);
CREATE POLICY log_write ON operation_logs FOR INSERT WITH CHECK (true);

-- ====== 完成 ======
DO $$ BEGIN
  RAISE NOTICE '✅ 权限系统v2初始化完成！7角色 + 数据隔离 + 操作日志';
END $$;
