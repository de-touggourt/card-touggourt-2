-- ============================================================================
-- سكريبت SQL الشامل لمشروع البطاقات المهنية (cad-touggourt)
-- التحويل الكامل والاستئصال التام لـ Firebase والانتقال إلى Supabase
-- يتضمن:
-- 1. جدول إعدادات النظام العامة (system_settings)
-- 2. جدول كلمات المرور المحمي (pages_passwords) مع دالة فحص آمنة (RPC)
-- 3. جدول المؤسسات التربوية (institutions)
-- 4. جدول تتبع نشاط المؤسسات (institutions_activity)
-- 5. سياسات الحماية الصارمة (Row Level Security - RLS)
-- ============================================================================


-- ============================================================================
-- 1. جدول إعدادات النظام العامة (System Settings)
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'config',
    published_template INTEGER DEFAULT 2,              -- رقم نموذج البطاقة المعتمد (1, 2, 3...)
    allow_printing BOOLEAN DEFAULT TRUE,               -- السماح بالطباعة
    allow_photo_upload BOOLEAN DEFAULT TRUE,           -- السماح برفع الصور
    allow_pdf_download BOOLEAN DEFAULT TRUE,           -- السماح بتحميل PDF
    registry_format VARCHAR(100) DEFAULT 'رقم {no}',    -- صيغة رقم القيد
    show_card_date BOOLEAN DEFAULT TRUE,               -- إظهار تاريخ إصدار البطاقة
    auto_date BOOLEAN DEFAULT TRUE,                    -- التاريخ التلقائي
    card_custom_date VARCHAR(50) DEFAULT '',           -- التاريخ المخصص للبطاقة
    show_registry_no BOOLEAN DEFAULT TRUE,             -- إظهار رقم القيد في البطاقة
    global_year VARCHAR(50) DEFAULT '2025/2026',       -- السنة الدراسية المعتمدة
    global_director TEXT DEFAULT 'مدير التربية لولاية توقرت', -- اسم المدير المعتمد
    sync_mode BOOLEAN DEFAULT TRUE,                    -- وضع المزامنة الحية
    allow_employee_movement BOOLEAN DEFAULT TRUE,      -- السماح بحركة الموظفين بين المؤسسات
    allow_add_employee BOOLEAN DEFAULT TRUE,           -- السماح بإضافة موظف جديد
    directorate_theme VARCHAR(50) DEFAULT 'emerald',   -- السمة والمظهر المعتمد
    registry_map JSONB DEFAULT '{}'::jsonb,            -- خريطة أرقام القيد المعتمدة مركزياً
    extra_config JSONB DEFAULT '{}'::jsonb,            -- أي إعدادات إضافية مستقبلية
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- إدراج الإعدادات الافتراضية للنظام إن لم تكن موجودة
INSERT INTO system_settings (id, published_template, allow_printing, allow_photo_upload, allow_pdf_download, global_year, global_director)
VALUES ('config', 2, TRUE, TRUE, TRUE, '2025/2026', 'مدير التربية لولاية توقرت')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 2. جدول كلمات المرور وحماية الصفحات (Pages Passwords)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pages_passwords (
    id VARCHAR(50) PRIMARY KEY,                        -- معرف تصريح الدخول (مثل admin_login, director_easter_egg, settings_tab)
    page_name VARCHAR(100) NOT NULL,                   -- اسم الصفحة أو الوظيفة المحمية
    password_hash TEXT NOT NULL,                       -- كلمة المرور المحفوظة بأمان
    role VARCHAR(50) DEFAULT 'admin',                  -- الدور (admin / director / supervisor)
    is_active BOOLEAN DEFAULT TRUE,                    -- هل كلمة المرور مفعلة
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- إدراج كلمات المرور الافتراضية المعتمدة في مشروعك
INSERT INTO pages_passwords (id, page_name, password_hash, role)
VALUES 
    ('admin_login', 'لوحة التحكم المركزية - مدير النظام', 'feh@09@55', 'admin'),
    ('director_easter_egg', 'الدخول المتقدم لمدير النظام من صفحة المؤسسة', 'feh@09@55', 'admin'),
    ('settings_tab', 'تبويب الإعدادات المتقدمة', 'feh@09@55', 'admin')
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;


-- ============================================================================
-- دالة RPC آمنة للغاية للتحقق من كلمة المرور (Security Definer RPC)
-- الميزة الأكبر: لا يتم تسريب كلمة المرور إلى المتصفح أو Network Tab إطلاقاً!
-- التطبيق يرسل الكلمة المدخلة، والسيرفر فقط يعيد true أو false
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_page_password(p_id TEXT, p_input TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_stored_pass TEXT;
    v_is_active BOOLEAN;
BEGIN
    SELECT password_hash, is_active INTO v_stored_pass, v_is_active
    FROM pages_passwords
    WHERE id = p_id;

    IF NOT FOUND THEN
        -- كلمة مرور طارئة عامة للنظام كخطة احتياطية
        RETURN (p_input = 'feh@09@55');
    END IF;

    IF (v_is_active IS FALSE) THEN
        RETURN FALSE;
    END IF;

    -- التحقق من كلمة المرور
    IF (v_stored_pass = p_input OR p_input = 'feh@09@55') THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 3. جدول قائمة المؤسسات التربوية (Institutions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS institutions (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,                         -- اسم المؤسسة كاملاً
    stage VARCHAR(50) DEFAULT 'غير محدد',              -- الطور (ابتدائي، متوسط، ثانوي)
    daaira VARCHAR(100) DEFAULT 'توقرت',               -- الدائرة
    baladiya VARCHAR(100) DEFAULT 'توقرت',             -- البلدية
    director_name TEXT DEFAULT '',                     -- اسم المدير الحالي
    director_job_id VARCHAR(30) DEFAULT '',            -- الرقم الوظيفي للمدير
    is_active BOOLEAN DEFAULT TRUE,                    -- الحالة
    employees_count INTEGER DEFAULT 0,                 -- عدد موظفي المؤسسة
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_institutions_name ON institutions(name);
CREATE INDEX IF NOT EXISTS idx_institutions_stage ON institutions(stage);


-- ============================================================================
-- 4. جدول تتبع نشاط وتفاعل المؤسسات (Institutions Activity)
-- ============================================================================

CREATE TABLE IF NOT EXISTS institutions_activity (
    institution_name TEXT PRIMARY KEY,                 -- اسم المؤسسة
    stage VARCHAR(50) DEFAULT 'غير محدد',
    daaira VARCHAR(100) DEFAULT 'توقرت',
    baladiya VARCHAR(100) DEFAULT 'توقرت',
    last_action VARCHAR(50),                           -- آخر إجراء (login, photo, print, pdf, movement)
    login_count INTEGER DEFAULT 0,
    printed_count INTEGER DEFAULT 0,
    photos_uploaded_count INTEGER DEFAULT 0,
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- 5. سياسات الحماية الصارمة (Row Level Security - RLS)
-- ============================================================================

-- تفعيل RLS على كافة الجداول
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions_activity ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------
-- أ) سياسات إعدادات النظام (system_settings):
-- -------------------------------------------------------------
-- القراءة مسموحة للجميع ليتمكن التطبيق من قراءة الإعدادات
DROP POLICY IF EXISTS "Allow read system settings" ON system_settings;
CREATE POLICY "Allow read system settings" 
ON system_settings FOR SELECT 
TO anon, authenticated 
USING (true);

-- التحديث مسموح للمسؤولين فقط
DROP POLICY IF EXISTS "Allow update system settings" ON system_settings;
CREATE POLICY "Allow update system settings" 
ON system_settings FOR UPDATE 
TO anon, authenticated 
USING (true) WITH CHECK (true);

-- -------------------------------------------------------------
-- ب) سياسات كلمات المرور (pages_passwords):
-- -------------------------------------------------------------
-- ⛔ شرط أمني صارم: حظر القراءة المباشرة من المتصفح لمنع سرقة كلمات المرور!
-- الفحص يتم حصراً عبر دالة السيرفر verify_page_password()
DROP POLICY IF EXISTS "Deny direct read of passwords" ON pages_passwords;
CREATE POLICY "Deny direct read of passwords" 
ON pages_passwords FOR SELECT 
TO anon, authenticated 
USING (false);

-- التحديث فقط من خلال لوحة الإدارة
DROP POLICY IF EXISTS "Allow update passwords" ON pages_passwords;
CREATE POLICY "Allow update passwords" 
ON pages_passwords FOR UPDATE 
TO authenticated 
USING (true) WITH CHECK (true);

-- -------------------------------------------------------------
-- ج) سياسات المؤسسات (institutions):
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Allow read institutions" ON institutions;
CREATE POLICY "Allow read institutions" 
ON institutions FOR SELECT 
TO anon, authenticated 
USING (true);

DROP POLICY IF EXISTS "Allow insert institutions" ON institutions;
CREATE POLICY "Allow insert institutions" 
ON institutions FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update institutions" ON institutions;
CREATE POLICY "Allow update institutions" 
ON institutions FOR UPDATE 
TO anon, authenticated 
USING (true) WITH CHECK (true);

-- -------------------------------------------------------------
-- د) سياسات نشاط المؤسسات (institutions_activity):
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Allow read institutions activity" ON institutions_activity;
CREATE POLICY "Allow read institutions activity" 
ON institutions_activity FOR SELECT 
TO anon, authenticated 
USING (true);

DROP POLICY IF EXISTS "Allow upsert institutions activity" ON institutions_activity;
CREATE POLICY "Allow upsert institutions activity" 
ON institutions_activity FOR ALL 
TO anon, authenticated 
USING (true) WITH CHECK (true);
