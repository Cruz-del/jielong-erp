-- ============================================================
-- 捷隆纺织外贸订单管理系统 - 数据库初始化脚本
-- 在 Supabase SQL Editor 中执行此脚本
--
-- ⚠️ 重要：如果之前执行过旧版本，请先执行下方注释掉的 DROP 语句
-- ============================================================

-- 0. 环境准备：先删除旧表（如果需要重建）
-- 取消注释下面这行来完全重建所有表：
-- DROP TABLE IF EXISTS tasks, documents, loading_plans, mark_library, design_productions, operation_logs, notifications, finance_rates, finance_expenses, finance_payments, inquiries, order_files, order_steps, orders, factories, customers, profiles CASCADE;

-- 使用 PostgreSQL 内置的 gen_random_uuid()，不需要 uuid-ossp 扩展
-- 如果 gen_random_uuid() 不可用，回退到 uuid-ossp
DO $$
BEGIN
  -- 尝试使用内置函数，如果失败则创建扩展
  PERFORM gen_random_uuid();
EXCEPTION WHEN undefined_function THEN
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
END $$;

-- ============================================================
-- 1. 用户档案表（关联 Supabase Auth）
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT '跟单员' CHECK (role IN (
    '超级管理员','跟单主管','跟单员','财务主管','财务助理','老板'
  )),
  phone VARCHAR(20),
  avatar TEXT,
  department VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 新用户注册时自动创建 profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    '跟单员'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. 客户档案表
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  contact VARCHAR(100),
  email VARCHAR(200),
  phone VARCHAR(50),
  country VARCHAR(100),
  address TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. 工厂档案表
-- ============================================================
CREATE TABLE IF NOT EXISTS factories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  contact VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(200),
  address TEXT,
  capacity VARCHAR(100),
  rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. 订单主表
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pl_number VARCHAR(50) NOT NULL UNIQUE,
  customer_name VARCHAR(200),
  customer_id UUID REFERENCES customers(id),
  design_pattern VARCHAR(200),
  design_code VARCHAR(100),
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'm',
  order_date DATE DEFAULT CURRENT_DATE,
  delivery_date DATE,
  status VARCHAR(30) DEFAULT '设计' CHECK (status IN (
    '设计','打样','采购','生产','装箱','QC','出货','已完成','已取消'
  )),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  factory_id UUID REFERENCES factories(id),
  factory_name VARCHAR(200),
  price NUMERIC(12,2),
  currency VARCHAR(10) DEFAULT 'USD',
  total_amount NUMERIC(14,2),
  notes TEXT,
  is_delayed BOOLEAN DEFAULT false,
  delay_days INTEGER DEFAULT 0,
  delay_reason TEXT,
  created_by UUID REFERENCES profiles(id),
  assigned_to UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_pl_number ON orders(pl_number);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_factory ON orders(factory_id);
CREATE INDEX idx_orders_created_by ON orders(created_by);
CREATE INDEX idx_orders_assigned_to ON orders(assigned_to);

-- ============================================================
-- 5. 订单阶段记录表
-- ============================================================
CREATE TABLE IF NOT EXISTS order_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  step_name VARCHAR(50) NOT NULL CHECK (step_name IN (
    '设计','打样','采购','生产','装箱','QC','出货'
  )),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','blocked')),
  notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(order_id, step_name)
);

CREATE INDEX idx_order_steps_order ON order_steps(order_id);

-- ============================================================
-- 6. 订单附件表
-- ============================================================
CREATE TABLE IF NOT EXISTS order_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  file_name VARCHAR(500) NOT NULL,
  file_path TEXT NOT NULL,
  file_type VARCHAR(50) DEFAULT 'other' CHECK (file_type IN (
    'qc','customs','invoice','mark','design','contract','packing','other'
  )),
  file_size INTEGER,
  public_url TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_order_files_order ON order_files(order_id);

-- ============================================================
-- 7. 询价单表
-- ============================================================
CREATE TABLE IF NOT EXISTS inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_number VARCHAR(50) UNIQUE,
  customer_id UUID REFERENCES customers(id),
  customer_name VARCHAR(200),
  design_desc TEXT,
  quantity NUMERIC(12,2),
  unit VARCHAR(20) DEFAULT 'm',
  target_price NUMERIC(12,2),
  currency VARCHAR(10) DEFAULT 'USD',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending','quoted','negotiating','won','lost','cancelled'
  )),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 8. 回款记录表
-- ============================================================
CREATE TABLE IF NOT EXISTS finance_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  payment_date DATE DEFAULT CURRENT_DATE,
  payment_method VARCHAR(30),
  reference_number VARCHAR(100),
  verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payments_order ON finance_payments(order_id);
CREATE INDEX idx_payments_verified ON finance_payments(verified);

-- ============================================================
-- 9. 费用支出表
-- ============================================================
CREATE TABLE IF NOT EXISTS finance_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN (
    '原材料','加工费','运费','报关费','保险费','佣金','其他'
  )),
  amount NUMERIC(14,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'CNY',
  expense_date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_expenses_order ON finance_expenses(order_id);

-- ============================================================
-- 10. 汇率管理表
-- ============================================================
CREATE TABLE IF NOT EXISTS finance_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(10) NOT NULL,
  to_currency VARCHAR(10) NOT NULL DEFAULT 'CNY',
  rate NUMERIC(14,6) NOT NULL,
  source VARCHAR(50) DEFAULT 'manual',
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(from_currency, to_currency)
);

-- 插入默认汇率
INSERT INTO finance_rates (from_currency, to_currency, rate) VALUES
  ('USD', 'CNY', 7.25),
  ('EUR', 'CNY', 7.85),
  ('GBP', 'CNY', 9.15)
ON CONFLICT (from_currency, to_currency) DO NOTHING;

-- ============================================================
-- 11. 通知消息表
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  message TEXT,
  type VARCHAR(30) DEFAULT 'info' CHECK (type IN (
    'info','warning','error','success','order_update','payment_alert'
  )),
  read BOOLEAN DEFAULT false,
  related_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- ============================================================
-- 12. 操作日志表
-- ============================================================
CREATE TABLE IF NOT EXISTS operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  details JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_logs_user ON operation_logs(user_id);
CREATE INDEX idx_logs_created ON operation_logs(created_at DESC);
CREATE INDEX idx_logs_action ON operation_logs(action);

-- ============================================================
-- 13. 设计生产单表
-- ============================================================
CREATE TABLE IF NOT EXISTS design_productions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  design_file_url TEXT,
  design_status VARCHAR(30) DEFAULT 'pending' CHECK (design_status IN (
    'pending','in_design','reviewing','approved','rejected'
  )),
  production_status VARCHAR(30) DEFAULT 'pending' CHECK (production_status IN (
    'pending','weaving','dyeing','finishing','completed'
  )),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 14. 唛头库表
-- ============================================================
CREATE TABLE IF NOT EXISTS mark_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mark_code VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  category VARCHAR(50),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 15. 装柜计划表
-- ============================================================
CREATE TABLE IF NOT EXISTS loading_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  container_no VARCHAR(100),
  loading_date DATE,
  port_of_loading VARCHAR(100),
  port_of_destination VARCHAR(100),
  status VARCHAR(30) DEFAULT 'planned' CHECK (status IN (
    'planned','loading','in_transit','arrived','delivered'
  )),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 16. 报关单证表
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  doc_type VARCHAR(50) NOT NULL CHECK (doc_type IN (
    'commercial_invoice','packing_list','bill_of_lading','certificate_of_origin',
    'insurance','customs_declaration','inspection_cert','other'
  )),
  doc_number VARCHAR(100),
  file_url TEXT,
  issue_date DATE,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
    'draft','issued','submitted','verified'
  )),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 17. 待办任务表
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES profiles(id),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tasks_assignee ON tasks(assignee_id, status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- ============================================================
-- RLS 策略配置
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE factories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mark_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE loading_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 通用策略：已认证用户可读取
CREATE POLICY "Authenticated users can read profiles" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Authenticated users can read customers" ON customers
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Merchandiser can insert customers" ON customers
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Merchandiser can update customers" ON customers
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read factories" ON factories
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Merchandiser can insert factories" ON factories
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read orders" ON orders
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Merchandiser can insert orders" ON orders
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Merchandiser can update orders" ON orders
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read order_steps" ON order_steps
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Merchandiser can manage order_steps" ON order_steps
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read order_files" ON order_files
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Merchandiser can manage order_files" ON order_files
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read inquiries" ON inquiries
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Merchandiser can manage inquiries" ON inquiries
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Finance can read payments" ON finance_payments
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Finance can manage payments" ON finance_payments
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Finance can read expenses" ON finance_expenses
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Finance can manage expenses" ON finance_expenses
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read rates" ON finance_rates
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Finance can manage rates" ON finance_rates
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admin can read logs" ON operation_logs
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "System can create logs" ON operation_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read designs" ON design_productions
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Merchandiser can manage designs" ON design_productions
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read marks" ON mark_library
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Merchandiser can manage marks" ON mark_library
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read loading_plans" ON loading_plans
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Merchandiser can manage loading_plans" ON loading_plans
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read documents" ON documents
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Merchandiser can manage documents" ON documents
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read tasks" ON tasks
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can manage own tasks" ON tasks
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- 完成提示
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '✅ 捷隆纺织数据库初始化完成！';
  RAISE NOTICE '📋 已创建 17 张业务表 + RLS 策略';
  RAISE NOTICE '🔗 Supabase Auth 触发器已就绪';
END $$;
