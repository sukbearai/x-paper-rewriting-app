# 论文降重 Web 应用数据库设计

## Requirement Snapshot
- 支持用户名+密码与手机号+验证码登录，账号之间可建立邀请上下级关系
- 系统角色包含 `admin`、`agent`、`user`，积分余额可充值与消费
- 代理可查看并为自己邀请的用户充值，管理员可为任意用户充值
- 所有积分变更落库留痕，需具备安保与审计能力

---

## Schema Overview

### Table: `public.profiles`
```sql
CREATE TABLE public.profiles (
  id               bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username         text UNIQUE,
  phone            text UNIQUE,
  email            text,
  role             text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'agent', 'user')),
  points_balance   numeric NOT NULL DEFAULT 0,
  invite_code      text UNIQUE,
  invited_by       bigint REFERENCES public.profiles(id),
  created_at       timestamptz NOT NULL DEFAULT NOW(),
  updated_at       timestamptz NOT NULL DEFAULT NOW()
);
```
**Indexes**
```sql
CREATE INDEX idx_profiles_user_id       ON public.profiles(user_id);
CREATE INDEX idx_profiles_username      ON public.profiles(username);
CREATE INDEX idx_profiles_phone         ON public.profiles(phone);
CREATE INDEX idx_profiles_email         ON public.profiles(email);
CREATE INDEX idx_profiles_invite_code   ON public.profiles(invite_code);
CREATE INDEX idx_profiles_invited_by    ON public.profiles(invited_by);
```

### Table: `public.points_transactions`
```sql
CREATE TABLE public.points_transactions (
  id               bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  profile_id       bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('recharge', 'deduction', 'bonus')),
  amount           numeric NOT NULL,
  balance_after    numeric NOT NULL,
  description      text,
  reference_id     text,
  created_at       timestamptz NOT NULL DEFAULT NOW()
);
```
**Indexes**
```sql
CREATE INDEX idx_pts_profile_id ON public.points_transactions(profile_id);
CREATE INDEX idx_pts_created_at ON public.points_transactions(created_at);
```

### View: `public.agent_hierarchy`
```sql
CREATE OR REPLACE VIEW public.agent_hierarchy WITH (security_invoker = on) AS
SELECT
  p.id          AS profile_id,
  p.username,
  p.email,
  p.phone,
  p.points_balance,
  p.role,
  p.created_at,
  inviter.username AS inviter_username,
  inviter.id       AS inviter_id
FROM public.profiles AS p
LEFT JOIN public.profiles AS inviter ON p.invited_by = inviter.id;
```

---

## Functions & Triggers

### 邀请码 & Profile 初始化
```sql
CREATE OR REPLACE FUNCTION public.generate_unique_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  code text;
  exists boolean := true;
BEGIN
  WHILE exists LOOP
    code := upper(substring(md5(random()::text), 1, 3) || substring(md5(random()::text), 1, 3));
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE invite_code = code) INTO exists;
  END LOOP;
  RETURN code;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.invite_code := public.generate_unique_invite_code();
  IF NEW.role IS NULL THEN
    NEW.role := 'user';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_profile();
```

### 关键字段保护与更新时间戳
```sql
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_role text;
BEGIN
  SELECT COALESCE(raw_app_meta_data->>'role', 'user')
  INTO caller_role
  FROM auth.users
  WHERE id = (SELECT auth.uid());

  IF TG_OP = 'UPDATE' THEN
    IF (OLD.points_balance <> NEW.points_balance OR OLD.role <> NEW.role)
       AND caller_role <> 'admin' THEN
      RAISE EXCEPTION 'Only administrators may change role or points balance';
    END IF;
    NEW.updated_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_protect
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_sensitive_columns();
```

### 积分操作
```sql
CREATE OR REPLACE FUNCTION public.recharge_points(
  target_user_id uuid,
  amount numeric,
  description text DEFAULT 'Manual recharge'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  profile_id      bigint;
  current_balance numeric;
  new_balance     numeric;
BEGIN
  IF (SELECT COALESCE(raw_app_meta_data->>'role', 'user') FROM auth.users WHERE id = (SELECT auth.uid())) <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can recharge points';
  END IF;

  SELECT id, points_balance INTO profile_id, current_balance
  FROM public.profiles
  WHERE user_id = target_user_id;

  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  new_balance := current_balance + amount;

  UPDATE public.profiles
  SET points_balance = new_balance
  WHERE id = profile_id;

  INSERT INTO public.points_transactions (profile_id, transaction_type, amount, balance_after, description, reference_id)
  VALUES (profile_id, 'recharge', amount, new_balance, description, 'admin_recharge');

  RETURN true;
END;
$$;
```

```sql
CREATE OR REPLACE FUNCTION public.agent_recharge_to_referral(
  referral_id bigint,
  amount numeric,
  description text DEFAULT 'Agent recharge'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  agent_profile_id    bigint;
  referral_profile_id bigint;
  current_balance     numeric;
  new_balance         numeric;
  referral_invited_by bigint;
BEGIN
  SELECT id INTO agent_profile_id
  FROM public.profiles
  WHERE user_id = (SELECT auth.uid());

  IF agent_profile_id IS NULL THEN
    RAISE EXCEPTION 'Agent profile not found';
  END IF;

  IF (SELECT role FROM public.profiles WHERE id = agent_profile_id) <> 'agent' THEN
    RAISE EXCEPTION 'Only agents can use this function';
  END IF;

  SELECT id, points_balance, invited_by
  INTO referral_profile_id, current_balance, referral_invited_by
  FROM public.profiles
  WHERE id = referral_id;

  IF referral_profile_id IS NULL THEN
    RAISE EXCEPTION 'Referral user not found';
  END IF;

  IF referral_invited_by <> agent_profile_id THEN
    RAISE EXCEPTION 'This user is not under your agency';
  END IF;

  new_balance := current_balance + amount;

  UPDATE public.profiles
  SET points_balance = new_balance
  WHERE id = referral_profile_id;

  INSERT INTO public.points_transactions (profile_id, transaction_type, amount, balance_after, description, reference_id)
  VALUES (referral_profile_id, 'recharge', amount, new_balance, description, 'agent_recharge');

  RETURN true;
END;
$$;
```

### 注册流程辅助
```sql
CREATE OR REPLACE FUNCTION public.register_user_with_invite(
  p_email       text,
  p_password    text,
  p_username    text,
  p_phone       text DEFAULT NULL,
  p_invite_code text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_user_id    uuid;
  new_profile_id bigint;
  inviter_id     bigint;
BEGIN
  INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data)
  VALUES (p_email, crypt(p_password, gen_salt('bf')), jsonb_build_object('username', p_username))
  RETURNING id INTO new_user_id;

  IF p_invite_code IS NOT NULL AND p_invite_code <> '' THEN
    SELECT id INTO inviter_id FROM public.profiles WHERE invite_code = p_invite_code;
    IF inviter_id IS NULL THEN
      RAISE EXCEPTION 'Invalid invite code';
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, username, phone, email, invited_by)
  VALUES (new_user_id, p_username, p_phone, p_email, inviter_id)
  RETURNING id INTO new_profile_id;

  RETURN json_build_object(
    'success', true,
    'user_id', new_user_id,
    'profile_id', new_profile_id,
    'message', 'User registered successfully'
  );
END;
$$;
```

---

## Row Level Security (RLS)
```sql
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;
```

### Profiles 表策略
```sql
CREATE POLICY profiles_select_self
ON public.profiles FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY profiles_update_self
ON public.profiles FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY profiles_select_admin
ON public.profiles FOR SELECT TO authenticated
USING ((SELECT COALESCE((SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = (SELECT auth.uid())), '')) = 'admin');

CREATE POLICY profiles_update_admin
ON public.profiles FOR UPDATE TO authenticated
USING ((SELECT COALESCE((SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = (SELECT auth.uid())), '')) = 'admin')
WITH CHECK ((SELECT COALESCE((SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = (SELECT auth.uid())), '')) = 'admin');

CREATE POLICY profiles_select_agent_referrals
ON public.profiles FOR SELECT TO authenticated
USING (
  invited_by = (SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid()))
  OR (SELECT COALESCE((SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = (SELECT auth.uid())), '')) = 'agent'
);
```

### Points Transactions 表策略
```sql
CREATE POLICY pts_select_self
ON public.points_transactions FOR SELECT TO authenticated
USING (profile_id = (SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid())));

CREATE POLICY pts_select_admin
ON public.points_transactions FOR SELECT TO authenticated
USING ((SELECT COALESCE((SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = (SELECT auth.uid())), '')) = 'admin');

CREATE POLICY pts_insert_admin
ON public.points_transactions FOR INSERT TO authenticated
WITH CHECK ((SELECT COALESCE((SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = (SELECT auth.uid())), '')) = 'admin');
```

---

## Operational Notes
- 通过 Supabase/Edge Function 或服务器中间层调用积分/注册函数，复用角色与上下级校验
- `protect_profile_sensitive_columns` 阻止非管理员直接修改 `role` 或 `points_balance`
- 金额字段采用 `numeric`，如需限定精度可改为 `numeric(12,2)`
- 基于 `invited_by` 字段可构建无限级代理树，配合递归 CTE 实现下线查询
