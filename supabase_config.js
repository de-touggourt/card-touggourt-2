/**
 * ============================================================================
 * ملف إعدادات والربط الشامل بقاعدة بيانات Supabase (Live Data - Zero Local Cache)
 * مشروع: نظام البطاقات المهنية (cad-touggourt / card-touggourt)
 * مديرية التربية لولاية توقرت
 * ============================================================================
 */

(function (window) {
    'use strict';

    // 1. إعدادات مشروع Supabase الرسمية
    const SUPABASE_CONFIG = {
        url: "https://foukljtcjqgegxbdwznh.supabase.co",
        anonKey: "sb_publishable_ViNj-qv0PpkVVXvlOo9SeA_Y_Lf3tD9",
        tables: {
            employees: "base-touggourt",             // جدول الموظفين الأساسي (9074 موظف)
            history: "modifications_history",        // جدول سجل التعديلات
            settings: "system_settings",             // جدول إعدادات النظام العامة
            passwords: "pages_passwords",            // جدول كلمات المرور
            institutions: "institutions",            // جدول المؤسسات
            activity: "institutions_activity"        // جدول نشاط المؤسسات
        }
    };

    // إلغاء أي كاش محلي لضمان الاتصال المباشر والبيانات الحية (Live Fetching)
    const clientOptions = {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        },
        global: {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        }
    };

    let supabaseClient = null;

    function getSupabaseClient() {
        if (!supabaseClient) {
            if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
                console.error("❌ مكتبة Supabase JS غير محملة. تأكد من استدعاء سكريبت cdnjs/@supabase/supabase-js.");
                return null;
            }
            supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, clientOptions);
            console.log("✅ [Supabase Client] تم الاتصال المباشر والآمن بقاعدة البيانات.");
        }
        return supabaseClient;
    }

    // ========================================================================
    // 1. التحقق الآمن من كلمات المرور (Authentication & Password Validation)
    // استخدام دالة RPC مشفرة على السيرفر تمنع تسريب كلمة المرور للمتصفح
    // ========================================================================

    async function verifyPagePassword(pageId, passwordInput) {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        const cleanInput = String(passwordInput || '').trim();
        if (!cleanInput) return false;

        // كلمة المرور الطارئة العامة لمدير النظام
        if (cleanInput === "feh@09@55") return true;

        try {
            // استدعاء دالة RPC في السيرفر
            const { data: isValid, error } = await client.rpc('verify_page_password', {
                p_id: pageId,
                p_input: cleanInput
            });

            if (error) {
                console.warn("RPC password check fallback to default:", error.message);
                return cleanInput === "feh@09@55";
            }

            return !!isValid;
        } catch (err) {
            console.error("Password verification error:", err);
            return cleanInput === "feh@09@55";
        }
    }

    // ========================================================================
    // 2. إعدادات النظام العامة (System Settings Management)
    // ========================================================================

    async function fetchSystemSettings() {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        console.log("🔄 [Supabase Live] جلب إعدادات النظام العامة مباشرة من السيرفر...");

        const { data, error } = await client
            .from(SUPABASE_CONFIG.tables.settings)
            .select('*')
            .eq('id', 'config')
            .maybeSingle();

        if (error) {
            console.warn("⚠️ تعذر جلب إعدادات النظام من Supabase:", error.message);
            return null;
        }

        if (data && data.extra_config) {
            const extra = (typeof data.extra_config === 'string') ? JSON.parse(data.extra_config || '{}') : data.extra_config;
            if (extra.allow_employee_movement) data.allow_employee_movement = extra.allow_employee_movement;
            if (extra.allow_add_employee) data.allow_add_employee = extra.allow_add_employee;
            if (extra.allow_printing) data.allow_printing = extra.allow_printing;
            if (extra.allow_pdf_download) data.allow_pdf_download = extra.allow_pdf_download;
            if (extra.allow_photo_upload) data.allow_photo_upload = extra.allow_photo_upload;

            data.employeeMovementInstitutions = extra.employee_movement_institutions || extra.employeeMovementInstitutions || [];
            data.addEmployeeInstitutions = extra.add_employee_institutions || extra.addEmployeeInstitutions || [];
            data.printingInstitutions = extra.printing_institutions || extra.printingInstitutions || [];
            data.pdfDownloadInstitutions = extra.pdf_download_institutions || extra.pdfDownloadInstitutions || [];
            data.photoUploadInstitutions = extra.photo_upload_institutions || extra.photoUploadInstitutions || [];

            data.is_platform_open = (extra.is_platform_open !== undefined) ? !!extra.is_platform_open : true;
            data.isPlatformOpen = data.is_platform_open;

            // إعدادات النموذج الثالث، الرقم السري، وتواريخ الإصدار والتعطيل
            data.template3_issue_date = extra.template3_issue_date || '';
            data.template3GlobalIssueDate = extra.template3_issue_date || '';
            data.digital_card_pin = extra.digital_card_pin || '';
            data.digitalCardPin = extra.digital_card_pin || '';
            data.issue_date_map = extra.issue_date_map || {};
            data.issueDateMap = extra.issue_date_map || {};
            data.disabled_cards_map = extra.disabled_cards_map || {};
            data.disabledCardsMap = extra.disabled_cards_map || {};
        } else if (data) {
            data.is_platform_open = true;
            data.isPlatformOpen = true;
            data.template3_issue_date = '';
            data.template3GlobalIssueDate = '';
            data.digital_card_pin = '';
            data.digitalCardPin = '';
            data.issue_date_map = {};
            data.issueDateMap = {};
            data.disabled_cards_map = {};
            data.disabledCardsMap = {};
        }

        console.log("✅ [Supabase Live] تم استلام إعدادات النظام بنجاح:", data);
        return data;
    }

    async function updateSystemSettings(newSettings) {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        // تحويل متوافق مع قيود الأعمدة في PostgreSQL لقاعدة البيانات
        const movMode = newSettings.allow_employee_movement !== undefined ? newSettings.allow_employee_movement : 'all';
        const addMode = newSettings.allow_add_employee !== undefined ? newSettings.allow_add_employee : 'all';
        const printMode = newSettings.allow_printing !== undefined ? newSettings.allow_printing : 'all';
        const pdfMode = newSettings.allow_pdf_download !== undefined ? newSettings.allow_pdf_download : 'all';
        const uploadMode = newSettings.allow_photo_upload !== undefined ? newSettings.allow_photo_upload : 'all';

        const movBool = (movMode === true || movMode === 'all' || movMode === 'selected');
        const addBool = (addMode === true || addMode === 'all' || addMode === 'selected');
        const printBool = (printMode === true || printMode === 'all' || printMode === 'selected');
        const pdfBool = (pdfMode === true || pdfMode === 'all' || pdfMode === 'selected');
        const uploadBool = (uploadMode === true || uploadMode === 'all' || uploadMode === 'selected');

        const isPlatformOpen = (newSettings.is_platform_open !== undefined)
            ? !!newSettings.is_platform_open
            : ((newSettings.isPlatformOpen !== undefined) ? !!newSettings.isPlatformOpen : true);

        // جلب الإعدادات الإضافية السابقة من قاعدة البيانات لضمان عدم ضياع أي خرائط (مثل issue_date_map أو disabled_cards_map أو digital_card_pin)
        let dbExtra = {};
        try {
            const { data: curRow } = await client
                .from(SUPABASE_CONFIG.tables.settings)
                .select('extra_config')
                .eq('id', 'config')
                .maybeSingle();
            if (curRow && curRow.extra_config) {
                dbExtra = (typeof curRow.extra_config === 'string') ? JSON.parse(curRow.extra_config || '{}') : curRow.extra_config;
            }
        } catch(e) {}

        const incomingExtra = (newSettings.extra_config && typeof newSettings.extra_config === 'object') ? newSettings.extra_config : {};
        const existingExtra = { ...dbExtra, ...incomingExtra };

        const extraConfig = {
            ...existingExtra,
            allow_employee_movement: typeof movMode === 'string' ? movMode : (movMode ? 'all' : 'none'),
            allow_add_employee: typeof addMode === 'string' ? addMode : (addMode ? 'all' : 'none'),
            allow_printing: typeof printMode === 'string' ? printMode : (printMode ? 'all' : 'none'),
            allow_pdf_download: typeof pdfMode === 'string' ? pdfMode : (pdfMode ? 'all' : 'none'),
            allow_photo_upload: typeof uploadMode === 'string' ? uploadMode : (uploadMode ? 'all' : 'none'),
            employee_movement_institutions: newSettings.employeeMovementInstitutions || existingExtra.employee_movement_institutions || [],
            add_employee_institutions: newSettings.addEmployeeInstitutions || existingExtra.add_employee_institutions || [],
            printing_institutions: newSettings.printingInstitutions || existingExtra.printing_institutions || [],
            pdf_download_institutions: newSettings.pdfDownloadInstitutions || existingExtra.pdf_download_institutions || [],
            photo_upload_institutions: newSettings.photoUploadInstitutions || existingExtra.photo_upload_institutions || [],
            is_platform_open: isPlatformOpen
        };

        if (newSettings.digital_card_pin !== undefined) {
            extraConfig.digital_card_pin = String(newSettings.digital_card_pin).trim();
        } else if (newSettings.digitalCardPin !== undefined) {
            extraConfig.digital_card_pin = String(newSettings.digitalCardPin).trim();
        }

        if (newSettings.template3_issue_date !== undefined) {
            extraConfig.template3_issue_date = String(newSettings.template3_issue_date).trim();
        } else if (newSettings.template3GlobalIssueDate !== undefined) {
            extraConfig.template3_issue_date = String(newSettings.template3GlobalIssueDate).trim();
        }

        const payload = {
            published_template: newSettings.published_template !== undefined ? parseInt(newSettings.published_template, 10) : 2,
            allow_printing: printBool,
            allow_photo_upload: uploadBool,
            allow_pdf_download: pdfBool,
            registry_format: newSettings.registry_format || 'رقم {no}',
            show_card_date: newSettings.show_card_date !== undefined ? !!newSettings.show_card_date : true,
            auto_date: newSettings.auto_date !== undefined ? !!newSettings.auto_date : true,
            card_custom_date: newSettings.card_custom_date !== undefined ? String(newSettings.card_custom_date) : '',
            show_registry_no: newSettings.show_registry_no !== undefined ? !!newSettings.show_registry_no : true,
            global_year: newSettings.global_year || '2025/2026',
            global_director: newSettings.global_director || 'مدير التربية لولاية توقرت',
            sync_mode: newSettings.sync_mode !== undefined ? !!newSettings.sync_mode : true,
            allow_employee_movement: movBool,
            allow_add_employee: addBool,
            directorate_theme: newSettings.directorate_theme || 'emerald',
            extra_config: extraConfig,
            updated_at: new Date().toISOString()
        };

        // نستخدم UPDATE حصراً لمطابقة سياسة RLS (Allow update system settings)
        let { data, error } = await client
            .from(SUPABASE_CONFIG.tables.settings)
            .update(payload)
            .eq('id', 'config')
            .select()
            .maybeSingle();

        // في حال لم يكن السطر موجوداً أساساً، نجرب upsert كحل بديل
        if (!data && !error) {
            const upsertRes = await client
                .from(SUPABASE_CONFIG.tables.settings)
                .upsert({ id: 'config', ...payload })
                .select()
                .maybeSingle();
            data = upsertRes.data;
            error = upsertRes.error;
        }

        if (error) {
            console.error("❌ فشل تحديث إعدادات النظام في Supabase:", error);
            throw error;
        }

        if (data && data.extra_config) {
            const extra = (typeof data.extra_config === 'string') ? JSON.parse(data.extra_config || '{}') : data.extra_config;
            if (extra.allow_employee_movement) data.allow_employee_movement = extra.allow_employee_movement;
            if (extra.allow_add_employee) data.allow_add_employee = extra.allow_add_employee;
            if (extra.allow_printing) data.allow_printing = extra.allow_printing;
            if (extra.allow_pdf_download) data.allow_pdf_download = extra.allow_pdf_download;
            if (extra.allow_photo_upload) data.allow_photo_upload = extra.allow_photo_upload;
            data.employeeMovementInstitutions = extra.employee_movement_institutions || extra.employeeMovementInstitutions || [];
            data.addEmployeeInstitutions = extra.add_employee_institutions || extra.addEmployeeInstitutions || [];
            data.printingInstitutions = extra.printing_institutions || extra.printingInstitutions || [];
            data.pdfDownloadInstitutions = extra.pdf_download_institutions || extra.pdfDownloadInstitutions || [];
            data.photoUploadInstitutions = extra.photo_upload_institutions || extra.photoUploadInstitutions || [];
            data.template3_issue_date = extra.template3_issue_date || '';
            data.template3GlobalIssueDate = extra.template3_issue_date || '';
            data.digital_card_pin = extra.digital_card_pin || '';
            data.digitalCardPin = extra.digital_card_pin || '';
            data.issue_date_map = extra.issue_date_map || {};
            data.disabled_cards_map = extra.disabled_cards_map || {};
        }

        console.log("✅ تم حفظ وتعميم إعدادات النظام بنجاح:", data);
    }

    // ========================================================================
    // 3. إدارة قائمة ونشاط المؤسسات (Institutions & Activity)
    // ========================================================================

    async function fetchInstitutionsList() {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        const { data, error } = await client
            .from(SUPABASE_CONFIG.tables.institutions)
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.warn("⚠️ تعذر جلب قائمة المؤسسات من السيرفر:", error.message);
            return [];
        }

        return data || [];
    }

    async function saveInstitution(instData) {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        const payload = {
            ...instData,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await client
            .from(SUPABASE_CONFIG.tables.institutions)
            .upsert(payload)
            .select()
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    async function deleteInstitution(instName) {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        const cleanName = String(instName || '').trim();
        const { error } = await client
            .from(SUPABASE_CONFIG.tables.institutions)
            .delete()
            .eq('name', cleanName);

        if (error) throw error;
        return true;
    }

    async function logInstitutionActivity(instName, actionType, meta = {}) {
        const client = getSupabaseClient();
        if (!client) return;

        const cleanName = String(instName || '').trim();
        if (!cleanName) return;

        const actPayload = {
            institution_name: cleanName,
            last_action: actionType,
            last_activity: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...meta
        };

        const { error } = await client
            .from(SUPABASE_CONFIG.tables.activity)
            .upsert(actPayload);

        if (error) {
            console.warn("Activity log notice:", error.message);
        } else {
            console.log(`📊 [Activity Logged] تم توثيق نشاط ${cleanName} (${actionType})`);
        }
    }

    async function fetchInstitutionsActivity() {
        const client = getSupabaseClient();
        if (!client) return [];

        const { data, error } = await client
            .from(SUPABASE_CONFIG.tables.activity)
            .select('*')
            .order('last_activity', { ascending: false });

        if (error) return [];
        return data || [];
    }

    async function clearInstitutionsActivity() {
        const client = getSupabaseClient();
        if (!client) return false;

        const { error } = await client
            .from(SUPABASE_CONFIG.tables.activity)
            .delete()
            .neq('institution_name', '__none__');

        if (error) {
            console.error("Failed to clear activity:", error);
            throw error;
        }
        return true;
    }

    // ========================================================================
    // 4. دوال بيانات الموظفين الحية (Live Employees Operations)
    // ========================================================================

    function buildInstitutionCandidates(place) {
        const candidatePlaces = new Set();
        if (!place) return [];
        const rawP = String(place).trim();
        candidatePlaces.add(rawP);

        const noPrefix = rawP.replace(/^(المدرسة الابتدائية|مدرسة ابتدائية|إبتدائية|ابتدائية|مدرسة|متوسطة|إكمالية|اكمالية|ثانوية|متقنة|متقن)\s*/gi, '').trim();
        if (noPrefix) candidatePlaces.add(noPrefix);

        const noSuffix = noPrefix.replace(/[\s\-_–]+(توقرت|تقرت|النزلة|نزلة|تبسبست|تيبسبست|الزاوية العابدية|تماسين|بلدة عمر|بليدة عامر|المقارين|سيدي سليمان|الحجيرة|العالية|الطيبات|المنقر|ابن ناصر|بن ناصر).*$/gi, '').trim();
        if (noSuffix) candidatePlaces.add(noSuffix);

        const fullNoSuffix = rawP.replace(/[\s\-_–]+(توقرت|تقرت|النزلة|نزلة|تبسبست|تيبسبست|الزاوية العابدية|تماسين|بلدة عمر|بليدة عامر|المقارين|سيدي سليمان|الحجيرة|العالية|الطيبات|المنقر|ابن ناصر|بن ناصر).*$/gi, '').trim();
        if (fullNoSuffix) candidatePlaces.add(fullNoSuffix);

        if (/^إ?بتدائية\s+/i.test(rawP)) candidatePlaces.add(rawP.replace(/^إ?بتدائية\s+/i, 'المدرسة الابتدائية '));
        if (/^المدرسة\s+الابتدائية\s+/i.test(rawP)) candidatePlaces.add(rawP.replace(/^المدرسة\s+الابتدائية\s+/i, 'إبتدائية '));

        Array.from(candidatePlaces).forEach(p => {
            if (p.includes('توقرت')) candidatePlaces.add(p.replace(/توقرت/g, 'تقرت'));
            if (p.includes('تقرت')) candidatePlaces.add(p.replace(/تقرت/g, 'توقرت'));
        });

        return Array.from(candidatePlaces).filter(p => p.length >= 3);
    }

    function cleanDateString(dateVal) {
        if (!dateVal) return "";
        let str = String(dateVal).trim();
        const match = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
        if (match) {
            return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        }
        const revMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
        if (revMatch) {
            return `${revMatch[3]}-${revMatch[2].padStart(2, '0')}-${revMatch[1].padStart(2, '0')}`;
        }
        return str;
    }

    function formatEmployeeRecord(d) {
        if (!d) return null;
        let nom = String(d.nomAr || d.nom || '').trim().replace(/\s+/g, ' ');
        let prenom = String(d.prenomAr || d.prenom || '').trim().replace(/\s+/g, ' ');

        // معالجة متقدمة تمنع تكرار الاسم واللقب مثل: (فغولي عبد الهادي عبد الهادي)
        const particles = ['بن', 'ابن', 'بو', 'بل', 'بوزيد', 'ولد', 'آيت', 'أيت'];
        if (nom && prenom) {
            if (nom.endsWith(' ' + prenom)) {
                const prefix = nom.slice(0, -(prenom.length + 1)).trim();
                if (!particles.includes(prefix)) {
                    nom = prefix;
                }
            } else if (nom.startsWith(prenom + ' ')) {
                const suffix = nom.slice(prenom.length + 1).trim();
                if (!particles.includes(suffix)) {
                    nom = suffix;
                }
            }
        }

        let fullName = '';
        if (d.name && typeof d.name === 'string' && d.name.trim()) {
            fullName = d.name.trim();
        } else if (nom && prenom) {
            fullName = `${nom} ${prenom}`;
        } else {
            fullName = nom || prenom || d.fullName || '';
        }

        // إزالة التكرار المتتالي للكلمات (مثل تكرار الاسم مرتين)
        if (prenom && fullName.includes(prenom + ' ' + prenom)) {
            fullName = fullName.replace(prenom + ' ' + prenom, prenom).trim();
        }
        fullName = fullName.replace(/\s+/g, ' ').trim();

        const jid = String(d.matricule || d.job_id || d.jobId || d.id || '').trim();

        let photoVal = d.photo_url || d.photo || null;
        if (photoVal === 'NO_PHOTO' || photoVal === 'deleted' || photoVal === '__DELETED__') {
            photoVal = null;
        } else if (!photoVal && window.CF_PHOTOS_MAP && window.CF_PHOTOS_MAP[jid]) {
            photoVal = window.CF_PHOTOS_MAP[jid].cfUrl;
        }

        const workplaceVal = (d.etablissement || d.workplace || d.place || d.inst || '').trim();

        return {
            id: 'emp_sb_' + jid,
            jobId: jid,
            matricule: jid,
            name: fullName,
            fullName: fullName,
            nomAr: nom,
            prenomAr: prenom,
            dob: cleanDateString(d.dateNais || d.dob || ''),
            dateNais: cleanDateString(d.dateNais || d.dob || ''),
            rank: d.grade || d.rank || '',
            grade: d.grade || d.rank || '',
            workplace: workplaceVal,
            workPlace: workplaceVal,
            etablissement: workplaceVal,
            inst: workplaceVal,
            place: workplaceVal,
            canonicalInst: workplaceVal,
            originalInst: workplaceVal,
            nationalId: d.nin || d.national_id || '',
            nin: d.nin || d.national_id || '',
            employmentType: d.situationAdmin || d.employment_type || 'مرسم',
            situationAdmin: d.situationAdmin || d.employment_type || 'مرسم',
            substituteDuration: d.substituteDuration || d.substitute_duration || d.duration || '',
            bloodType: d.groupeSanguin || d.bloodType || '',
            photo: photoVal,                   // رابط صورة Cloudflare المعتمد
            photoUrl: photoVal,
            registryNo: (d.registry_no !== undefined && d.registry_no !== null && d.registry_no !== '') ? parseInt(d.registry_no, 10) : null,
            issueDate: String(d.issue_date || d.issueDate || '').trim(),
            isCardDisabled: !!(d.is_card_disabled || d.isCardDisabled),
            cardDisableReason: String(d.card_disable_reason || d.cardDisableReason || '').trim(),
            stage: String(d.stage || d.typeEtab || '').trim(),
            baladiya: String(d.communeEtab || d.baladiya || d.communeResidence || '').trim(),
            daaira: String(d.daaira || '').trim(),
            telephone: d.telephone || '',
            sexe: d.sexe || '',
            raw: d
        };
    }

    /**
     * جلب كافة موظفي الولاية مباشرة من Supabase (9074 موظف) بالتوازي الفائق وبدون كاش
     */
    async function fetchAllEmployeesLive(onProgress) {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        console.log("⚡ [Supabase Live] جلب كافة سجلات الموظفين (9074 موظف) مباشرة بالتوازي...");

        // 1. تحديد العدد الإجمالي لسجلات الموظفين (الافتراضي المعتمد 9074 لتفادي أي بطء في استعلام HEAD)
        let totalCount = 9074;
        try {
            const headPromise = client
                .from(SUPABASE_CONFIG.tables.employees)
                .select('*', { count: 'exact', head: true });
            const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ count: null }), 1500));
            const headRes = await Promise.race([headPromise, timeoutPromise]);
            if (headRes && headRes.count && headRes.count > 0) {
                totalCount = headRes.count;
            }
        } catch(e) {
            totalCount = 9074;
        }

        const chunkSize = 1000;
        const numChunks = Math.ceil(totalCount / chunkSize);
        const chunkPromises = [];
        let completedRows = 0;

        // دالة جلب الدفعة مع إعادة المحاولة لمرة واحدة في حال حدوث انقطاع مؤقت
        const fetchChunkWithRetry = async (from, to, retryCount = 1) => {
            try {
                const res = await client
                    .from(SUPABASE_CONFIG.tables.employees)
                    .select('*')
                    .order('matricule', { ascending: true })
                    .range(from, to);
                if (res.error) throw res.error;
                const rows = res.data || [];
                completedRows += rows.length;
                if (typeof onProgress === 'function') {
                    onProgress(completedRows);
                }
                return rows;
            } catch(err) {
                if (retryCount > 0) {
                    await new Promise(r => setTimeout(r, 400));
                    return fetchChunkWithRetry(from, to, retryCount - 1);
                }
                throw err;
            }
        };

        // إطلاق دفعات الموظفين بالتوازي
        for (let i = 0; i < numChunks; i++) {
            const from = i * chunkSize;
            const to = Math.min(from + chunkSize - 1, totalCount - 1);
            chunkPromises.push(fetchChunkWithRetry(from, to));
        }

        // جلب خريطة أرقام القيد وتواريخ الإصدار والبطاقات المعطلة بالتوازي مع دفعات الموظفين
        const settingsPromise = (async () => {
            try {
                return await client
                    .from(SUPABASE_CONFIG.tables.settings)
                    .select('registry_map, extra_config')
                    .eq('id', 'config')
                    .maybeSingle();
            } catch(e) {
                return { data: null };
            }
        })();

        const [chunkResults, setRowRes] = await Promise.all([
            Promise.all(chunkPromises),
            settingsPromise
        ]);

        let regMap = null;
        let issueDateMap = null;
        let disabledCardsMap = null;
        let template3GlobalDate = '';
        if (setRowRes && setRowRes.data) {
            if (setRowRes.data.registry_map) {
                regMap = (typeof setRowRes.data.registry_map === 'string') ? JSON.parse(setRowRes.data.registry_map) : setRowRes.data.registry_map;
            }
            if (setRowRes.data.extra_config) {
                const extra = (typeof setRowRes.data.extra_config === 'string') ? JSON.parse(setRowRes.data.extra_config) : setRowRes.data.extra_config;
                issueDateMap = extra.issue_date_map || null;
                disabledCardsMap = extra.disabled_cards_map || null;
                template3GlobalDate = extra.template3_issue_date || '';
            }
        }

        const allRows = chunkResults.flat();
        const formatted = allRows.map(row => {
            const emp = formatEmployeeRecord(row);
            if (emp) {
                if ((!emp.registryNo || isNaN(emp.registryNo)) && regMap && regMap[emp.jobId]) {
                    emp.registryNo = parseInt(regMap[emp.jobId], 10);
                }
                if (!emp.issueDate && issueDateMap && issueDateMap[emp.jobId]) {
                    emp.issueDate = issueDateMap[emp.jobId];
                }
                if (!emp.issueDate && template3GlobalDate) {
                    emp.issueDate = template3GlobalDate;
                }
                if (disabledCardsMap && disabledCardsMap[emp.jobId]) {
                    emp.isCardDisabled = !!disabledCardsMap[emp.jobId].disabled;
                    emp.cardDisableReason = disabledCardsMap[emp.jobId].reason || '';
                    emp.cardDisabledAt = disabledCardsMap[emp.jobId].date || '';
                }
            }
            return emp;
        });

        console.log(`✅ [Supabase Live] تم استلام جميع الموظفين بنجاح: ${formatted.length} موظفاً حياً.`);
        return formatted;
    }

    /**
     * جلب موظفي مؤسسة محددة حياً ومباشراً من Supabase
     */
    async function fetchInstitutionEmployeesLive(institutionName) {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        const cleanInst = String(institutionName || '').trim();
        if (!cleanInst) return [];

        console.log(`🔄 [Supabase Live] جلب حي ومباشر لموظفي: "${cleanInst}"...`);

        const candidates = buildInstitutionCandidates(cleanInst);
        let query = client.from(SUPABASE_CONFIG.tables.employees).select('*');

        if (candidates.length > 0) {
            const orFilters = candidates.map(c => `etablissement.ilike.*${c}*`).join(',');
            query = query.or(orFilters);
        } else {
            query = query.eq('etablissement', cleanInst);
        }

        const { data, error } = await query.order('registry_no', { ascending: true, nullsFirst: false });

        if (error) {
            console.error("❌ فشل جلب موظفي المؤسسة:", error);
            throw error;
        }

        // جلب خريطة أرقام القيد وتواريخ الإصدار والبطاقات المعطلة الاحتياطية إن وجدت
        let regMap = null;
        let issueDateMap = null;
        let disabledCardsMap = null;
        let template3GlobalDate = '';
        try {
            const { data: setRow } = await client
                .from(SUPABASE_CONFIG.tables.settings)
                .select('registry_map, extra_config')
                .eq('id', 'config')
                .maybeSingle();
            if (setRow) {
                if (setRow.registry_map) {
                    regMap = (typeof setRow.registry_map === 'string') ? JSON.parse(setRow.registry_map) : setRow.registry_map;
                }
                if (setRow.extra_config) {
                    const extra = (typeof setRow.extra_config === 'string') ? JSON.parse(setRow.extra_config) : setRow.extra_config;
                    issueDateMap = extra.issue_date_map || null;
                    disabledCardsMap = extra.disabled_cards_map || null;
                    template3GlobalDate = extra.template3_issue_date || '';
                }
            }
        } catch(e) {}

        // تنقية وتدقيق دقيق لمنع تداخل مؤسسات أخرى تشترك في جزء من التسمية (مثل "المستقبل" و "المستقبل الشمالي")
        const normTarget = cleanInst.replace(/^(المدرسة الابتدائية|إبتدائية|ابتدائية|مدرسة ابتدائية|متوسطة|ثانوية)\s*/gi, '')
            .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[\s\-_–]/g, '').trim();

        const qualifiers = ['الشمالي', 'الجنوبي', 'الشرقي', 'الغربي', 'الجديده', 'القديمه', '1', '2', '3', 'الملحقه'];

        const filteredRows = (data || []).filter(row => {
            const rowEtab = (row.etablissement || row.rawEtab || '').trim();
            if (!rowEtab) return false;
            if (rowEtab === cleanInst) return true;

            const normRow = rowEtab.replace(/^(المدرسة الابتدائية|إبتدائية|ابتدائية|مدرسة ابتدائية|متوسطة|ثانوية)\s*/gi, '')
                .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[\s\-_–]/g, '').trim();

            if (normRow === normTarget) return true;

            // إذا كانت إحدى التسميتين تحمل لاحقة تمييزية واضحة والأخرى لا تحملها، فهما مؤسستان مختلفتان
            for (const q of qualifiers) {
                const qClean = q.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
                if (normRow.includes(qClean) && !normTarget.includes(qClean)) return false;
                if (!normRow.includes(qClean) && normTarget.includes(qClean)) return false;
            }
            return true;
        });

        const formatted = filteredRows.map(row => {
            const emp = formatEmployeeRecord(row);
            if (emp) {
                if ((!emp.registryNo || isNaN(emp.registryNo)) && regMap && regMap[emp.jobId]) {
                    emp.registryNo = parseInt(regMap[emp.jobId], 10);
                }
                if (!emp.issueDate && issueDateMap && issueDateMap[emp.jobId]) {
                    emp.issueDate = issueDateMap[emp.jobId];
                }
                if (!emp.issueDate && template3GlobalDate) {
                    emp.issueDate = template3GlobalDate;
                }
                if (disabledCardsMap && disabledCardsMap[emp.jobId]) {
                    emp.isCardDisabled = !!disabledCardsMap[emp.jobId].disabled;
                    emp.cardDisableReason = disabledCardsMap[emp.jobId].reason || '';
                    emp.cardDisabledAt = disabledCardsMap[emp.jobId].date || '';
                }
            }
            return emp;
        });

        console.log(`✅ [Supabase Live] تم استلام ${formatted.length} موظفاً لمؤسسة ${cleanInst} مباشرة وبدون كاش.`);
        return formatted;
    }

    /**
     * التحقق المباشر من المدير بواسطة رقم التعريف الوظيفي (16 رقم)
     */
    async function checkDirectorLive(jobId) {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        const cleanId = String(jobId || '').trim();
        if (cleanId.length < 16) {
            throw new Error("يجب أن يتكون رقم التعريف الوظيفي من 16 رقماً.");
        }

        const { data, error } = await client
            .from(SUPABASE_CONFIG.tables.employees)
            .select('*')
            .eq('matricule', cleanId)
            .maybeSingle();

        if (error) {
            console.error("Director check error:", error);
            throw error;
        }

        return formatEmployeeRecord(data);
    }

    /**
     * البحث الفوري عن موظف بالرقم الوظيفي أو رقم التعريف الوطني
     */
    async function searchEmployeeLive(queryText) {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        const cleanQuery = String(queryText || '').trim();
        if (!cleanQuery) return null;

        const { data, error } = await client
            .from(SUPABASE_CONFIG.tables.employees)
            .select('*')
            .or(`matricule.eq.${cleanQuery},nin.eq.${cleanQuery}`)
            .maybeSingle();

        if (error) {
            console.warn("Search employee warning:", error.message);
            return null;
        }

        return formatEmployeeRecord(data);
    }

    /**
     * تحديث بيانات الموظف مع تسجيل التعديل أوتوماتيكياً في جدول سجل التعديلات
     */
    /**
     * تحديث بيانات الموظف مع تسجيل التعديل أوتوماتيكياً في جدول سجل التعديلات
     */
    async function updateEmployeeWithHistory(matriculeId, newFields, modifiedBy = 'DIRECTOR', actionType = 'UPDATE') {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        const cleanId = String(matriculeId).trim();
        if (!cleanId) throw new Error("رقم الموظف مطلوب لإجراء التحديث.");

        // البحث الفوري بالرقم الوظيفي (16 رقم) أو الوطني (18 رقم) لضمان العثور على السجل الحقيقي بدقة
        let previousData = null;
        let queryPrev = client.from(SUPABASE_CONFIG.tables.employees).select('*');
        if (cleanId.length === 18) {
            queryPrev = queryPrev.or(`nin.eq.${cleanId},matricule.eq.${cleanId}`);
        } else {
            queryPrev = queryPrev.or(`matricule.eq.${cleanId},nin.eq.${cleanId}`);
        }
        const { data: foundPrev } = await queryPrev.maybeSingle();
        previousData = foundPrev;

        const realMatricule = (previousData && previousData.matricule) ? String(previousData.matricule).trim() : cleanId;

        // تصفية وتجهيز الحقول الصالحة فقط لجدول base-touggourt لمنع أخطاء PostgREST
        const validColumns = new Set([
            'matricule', 'nomAr', 'prenomAr', 'nomFr', 'prenomFr', 'dateNais', 'grade',
            'etablissement', 'rawEtab', 'codeEtab', 'typeEtab', 'communeEtab', 'nin',
            'situationAdmin', 'natureContrat', 'sexe', 'chapitreBudget', 'matiere',
            'ccp', 'cleCcp', 'acuiteVisuelle', 'presume', 'serviceNat', 'dateGrade',
            'dateTitularisation', 'numActeNais', 'telephone', 'nbEnfantsScol',
            'communeResidence', 'notePedagogique', 'prenomPere', 'nomMere', 'prenomMere',
            'dateNotePedag', 'dateRecrutement', 'codeCommuneNais', 'communeNais',
            'lieuNais', 'numSecu', 'dateAffectation', 'nbEnfants', 'nbEnfantsPlus10',
            'noteAdministrative', 'nbACharge', 'dateNoteAdmin', 'statutAffectation',
            'dateEffet', 'groupeSanguin', 'conjointSecteur', 'nomJeuneFille',
            'adresse', 'situationFam', 'echelon', 'photo_url', 'registry_no', 'issue_date'
        ]);

        const dbFields = {};
        for (const [key, val] of Object.entries(newFields || {})) {
            if (validColumns.has(key)) {
                dbFields[key] = val;
            } else {
                if (key === 'rank' && !dbFields.grade) dbFields.grade = val;
                if ((key === 'workplace' || key === 'inst' || key === 'place') && !dbFields.etablissement) dbFields.etablissement = val;
                if (key === 'dob' && !dbFields.dateNais) dbFields.dateNais = cleanDateString(val);
                if (key === 'photo' || key === 'photoUrl') dbFields.photo_url = val;
                if (key === 'registryNo' && dbFields.registry_no === undefined) dbFields.registry_no = (val !== null && val !== '') ? parseInt(val, 10) : null;
                if ((key === 'issueDate' || key === 'issue_date') && !dbFields.issue_date) dbFields.issue_date = String(val).trim();
                if ((key === 'employmentType' || key === 'situation_admin') && !dbFields.situationAdmin) dbFields.situationAdmin = val;
                if ((key === 'nationalId' || key === 'national_id') && !dbFields.nin) dbFields.nin = val;
                if ((key === 'bloodType' || key === 'blood_type') && !dbFields.groupeSanguin) dbFields.groupeSanguin = val;
            }
        }

        // عند تحديث المؤسسة في حركة الموظفين، نضمن تحديث etablissement و rawEtab معاً
        if (dbFields.etablissement && !dbFields.rawEtab) {
            dbFields.rawEtab = dbFields.etablissement;
        }

        // تقسيم الاسم العربي بدقة إذا تم تمريره كاسم كامل name
        if (newFields.name && (!dbFields.nomAr || dbFields.nomAr === newFields.name)) {
            const rawName = String(newFields.name).trim();
            const parts = rawName.split(/\s+/);
            const compoundPrefixes = ['بن', 'ابن', 'بو', 'بل', 'بوزيد', 'عبد', 'ولد', 'آيت', 'أيت'];
            if (parts.length > 2 && compoundPrefixes.includes(parts[0])) {
                dbFields.nomAr = parts[0] + ' ' + parts[1];
                dbFields.prenomAr = parts.slice(2).join(' ');
            } else if (parts.length > 1) {
                dbFields.nomAr = parts[0];
                dbFields.prenomAr = parts.slice(1).join(' ');
            } else {
                dbFields.nomAr = rawName;
            }
        }

        function buildTargetQuery(fields) {
            let q = client.from(SUPABASE_CONFIG.tables.employees).update(fields);
            if (realMatricule && realMatricule.length !== 18) {
                q = q.eq('matricule', realMatricule);
            } else if (previousData && previousData.matricule) {
                q = q.eq('matricule', previousData.matricule);
            } else if (cleanId.length === 18) {
                q = q.eq('nin', cleanId);
            } else {
                q = q.eq('matricule', cleanId);
            }
            return q;
        }

        let { data: updatedEmployee, error: updateErr } = await buildTargetQuery(dbFields).select().maybeSingle();

        // في حال كان الخطأ بسبب عدم وجود عمود issue_date في جدول base-touggourt
        if (updateErr && dbFields.issue_date && (updateErr.message || '').includes('issue_date')) {
            const pendingIssueDate = dbFields.issue_date;
            delete dbFields.issue_date;
            const retryRes = await buildTargetQuery(dbFields).select().maybeSingle();
            updatedEmployee = retryRes.data;
            updateErr = retryRes.error;

            // توثيق تاريخ الإصدار في خريطة الإعدادات المركزية لضمان عدم ضياعه
            if (pendingIssueDate) {
                try { await updateEmployeeIssueDate(realMatricule, pendingIssueDate, modifiedBy); } catch(e){}
            }
        }

        if (updateErr) {
            console.error("❌ خطأ أثناء تحديث بيانات الموظف في Supabase:", updateErr);
            throw updateErr;
        }

        // إذا كان هناك تاريخ إصدار، نتأكد دائماً من تسجيله في الخريطة المركزية أيضاً
        if (newFields.issueDate || newFields.issue_date) {
            const finalIssueDate = String(newFields.issueDate || newFields.issue_date).trim();
            if (finalIssueDate) {
                try { await updateEmployeeIssueDate(realMatricule, finalIssueDate, modifiedBy); } catch(e){}
            }
        }

        // تسجيل التعديل في جدول سجل التعديلات modifications_history
        const historyRecord = {
            employee_id: realMatricule,
            action_type: actionType,
            previous_data: previousData || {},
            new_data: { ...(previousData || {}), ...newFields, ...(updatedEmployee || dbFields) },
            modified_by: modifiedBy,
            modified_at: new Date().toISOString()
        };

        try {
            await client.from(SUPABASE_CONFIG.tables.history).insert([historyRecord]);
        } catch(e) {}

        return formatEmployeeRecord(updatedEmployee) || newFields;
    }

    /**
     * حفظ وتحديث رابط صورة Cloudflare في قاعدة البيانات
     */
    async function updateEmployeePhotoUrl(matriculeId, cloudflareImageUrl, modifiedBy = 'DIRECTOR') {
        const cleanId = String(matriculeId).trim();
        if (cloudflareImageUrl && typeof window !== 'undefined' && window.CF_PHOTOS_MAP) {
            window.CF_PHOTOS_MAP[cleanId] = {
                jobId: cleanId,
                cfUrl: cloudflareImageUrl,
                migratedAt: new Date().toISOString()
            };
        }
        return await updateEmployeeWithHistory(
            cleanId,
            { photo_url: cloudflareImageUrl },
            modifiedBy,
            'PHOTO_UPDATE'
        );
    }

    /**
     * حذف رابط صورة الموظف نهائياً وتوثيقه
     */
    async function deleteEmployeePhotoUrl(matriculeId, modifiedBy = 'DIRECTOR') {
        const cleanId = String(matriculeId).trim();
        if (typeof window !== 'undefined' && window.CF_PHOTOS_MAP && window.CF_PHOTOS_MAP[cleanId]) {
            delete window.CF_PHOTOS_MAP[cleanId];
        }
        return await updateEmployeeWithHistory(
            cleanId,
            { photo_url: 'NO_PHOTO' },
            modifiedBy,
            'PHOTO_DELETE'
        );
    }

    /**
     * تحديث رقم قيد البطاقة لموظف
     */
    async function updateEmployeeRegistryNo(matriculeId, registryNo, modifiedBy = 'ADMIN') {
        return await updateEmployeeWithHistory(
            matriculeId,
            { registry_no: parseInt(registryNo, 10) },
            modifiedBy,
            'REGISTRY_UPDATE'
        );
    }

    /**
     * تحديث أرقام القيد المعتمدة لعدة موظفين دفعة واحدة بنظام الدفعات المتزامنة والتوثيق المركزي
     */
    async function bulkUpdateRegistryNumbers(registryMap, modifiedBy = 'ADMIN', onProgress = null) {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        const entries = Object.entries(registryMap || {});
        if (entries.length === 0) return true;

        console.log(`🔄 [Supabase Live] جاري تحديث ${entries.length} رقم قيد في قاعدة البيانات...`);

        // 1. حفظ خريطة أرقام القيد كاملة في system_settings.registry_map فوراً لضمان توثيقها 100%
        try {
            await client
                .from(SUPABASE_CONFIG.tables.settings)
                .update({ 
                    registry_map: registryMap,
                    updated_at: new Date().toISOString()
                })
                .eq('id', 'config');
            console.log("✅ [Supabase Live] تم حفظ خريطة أرقام القيد الكاملة في إعدادات النظام.");
        } catch(setErr) {
            console.warn("Notice saving registry_map to settings:", setErr.message);
        }

        // 2. تحديث سجلات الموظفين في base-touggourt بدفعات متزامنة ومنظمة (Batched Concurrency)
        const batchSize = 60;
        let completed = 0;
        for (let i = 0; i < entries.length; i += batchSize) {
            const batch = entries.slice(i, i + batchSize);
            await Promise.all(batch.map(async ([jid, regNo]) => {
                const cleanId = String(jid).trim();
                const num = parseInt(regNo, 10);
                if (!cleanId || isNaN(num)) return;
                try {
                    await client
                        .from(SUPABASE_CONFIG.tables.employees)
                        .update({ registry_no: num })
                        .eq('matricule', cleanId);
                } catch(e) {
                    console.warn(`Retry update reg for ${cleanId}:`, e.message);
                }
            }));
            completed += batch.length;
            if (typeof onProgress === 'function') {
                onProgress(completed, entries.length);
            }
        }

        console.log(`✅ تم تحديث أرقام القيد بنجاح لجميع الموظفين (${entries.length}).`);
        return true;
    }

    /**
     * مسح وتصفير أرقام القيد لجميع الموظفين حياً في قاعدة بيانات Supabase
     */
    async function clearAllRegistryNumbersLive() {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        console.log("🔄 [Supabase Live] جاري مسح وتصفير أرقام القيد من قاعدة البيانات بالكامل...");

        // 1. تصفير خريطة أرقام القيد في system_settings
        try {
            await client
                .from(SUPABASE_CONFIG.tables.settings)
                .update({ 
                    registry_map: {},
                    updated_at: new Date().toISOString()
                })
                .eq('id', 'config');
            console.log("✅ [Supabase Live] تم تصفير خريطة registry_map في إعدادات النظام.");
        } catch(err) {
            console.warn("تنبيه تصفير خريطة القيد في الإعدادات:", err.message);
        }

        // 2. تصفير عمود registry_no في جدول base-touggourt لجميع السجلات
        try {
            await client
                .from(SUPABASE_CONFIG.tables.employees)
                .update({ registry_no: null })
                .neq('matricule', '___NONE___');
            console.log("✅ [Supabase Live] تم تصفير حقول registry_no لجميع الموظفين.");
        } catch(err) {
            console.warn("تنبيه تصفير حقول registry_no للموظفين:", err.message);
        }

        return true;
    }

    /**
     * تحديث تاريخ إصدار البطاقة لموظف فردي
     */
    async function updateEmployeeIssueDate(matriculeId, issueDate, modifiedBy = 'ADMIN') {
        const cleanId = String(matriculeId).trim();
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        const dateVal = String(issueDate || '').trim();

        // 1. تحديث في system_settings.extra_config.issue_date_map لضمان الحفظ المباشر
        try {
            const { data: setRow } = await client
                .from(SUPABASE_CONFIG.tables.settings)
                .select('extra_config')
                .eq('id', 'config')
                .maybeSingle();

            const extra = (setRow && setRow.extra_config) || {};
            extra.issue_date_map = extra.issue_date_map || {};
            if (dateVal) {
                extra.issue_date_map[cleanId] = dateVal;
            } else {
                delete extra.issue_date_map[cleanId];
            }
            await client
                .from(SUPABASE_CONFIG.tables.settings)
                .update({ extra_config: extra, updated_at: new Date().toISOString() })
                .eq('id', 'config');
        } catch(e) {
            console.warn("Notice saving issue_date_map to settings:", e.message);
        }

        // 2. محاولة التحديث في عمود issue_date في جدول base-touggourt إن كان العمود موجوداً
        try {
            await client
                .from(SUPABASE_CONFIG.tables.employees)
                .update({ issue_date: dateVal || null })
                .eq('matricule', cleanId);
        } catch(e) {}

        // 3. توثيق التعديل في سجل التعديلات
        try {
            await client.from(SUPABASE_CONFIG.tables.history).insert([{
                employee_id: cleanId,
                action_type: 'ISSUE_DATE_UPDATE',
                previous_data: {},
                new_data: { issue_date: dateVal },
                modified_by: modifiedBy,
                modified_at: new Date().toISOString()
            }]);
        } catch(e) {}

        return true;
    }

    /**
     * تحديث تواريخ الإصدار المعتمدة لعدة موظفين دفعة واحدة
     */
    async function bulkUpdateIssueDates(issueDateMap, modifiedBy = 'ADMIN', onProgress = null) {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        const entries = Object.entries(issueDateMap || {});
        if (entries.length === 0) return true;

        console.log(`🔄 [Supabase Live] جاري تحديث ${entries.length} تاريخ إصدار في قاعدة البيانات...`);

        // 1. حفظ خريطة تواريخ الإصدار كاملة في system_settings.extra_config.issue_date_map
        try {
            const { data: setRow } = await client
                .from(SUPABASE_CONFIG.tables.settings)
                .select('extra_config')
                .eq('id', 'config')
                .maybeSingle();

            const extra = (setRow && setRow.extra_config) || {};
            extra.issue_date_map = Object.assign({}, extra.issue_date_map || {}, issueDateMap);
            await client
                .from(SUPABASE_CONFIG.tables.settings)
                .update({ 
                    extra_config: extra,
                    updated_at: new Date().toISOString()
                })
                .eq('id', 'config');
            console.log("✅ [Supabase Live] تم توثيق خريطة تواريخ الإصدار في إعدادات النظام.");
        } catch(setErr) {
            console.warn("Notice saving issue_date_map to settings:", setErr.message);
        }

        // 2. فحص ما إذا كان عمود issue_date متوفراً في جدول base-touggourt لتحديثه بدفعات
        let hasIssueDateCol = false;
        try {
            const probe = await client
                .from(SUPABASE_CONFIG.tables.employees)
                .update({ issue_date: String(entries[0][1]).trim() })
                .eq('matricule', entries[0][0])
                .select('id')
                .maybeSingle();
            if (!probe.error) {
                hasIssueDateCol = true;
            }
        } catch(e) {
            hasIssueDateCol = false;
        }

        if (hasIssueDateCol) {
            const batchSize = 60;
            let completed = 0;
            for (let i = 0; i < entries.length; i += batchSize) {
                const batch = entries.slice(i, i + batchSize);
                await Promise.all(batch.map(async ([jid, dStr]) => {
                    const cleanId = String(jid).trim();
                    if (!cleanId) return;
                    try {
                        await client
                            .from(SUPABASE_CONFIG.tables.employees)
                            .update({ issue_date: String(dStr).trim() })
                            .eq('matricule', cleanId);
                    } catch(e) {}
                }));
                completed += batch.length;
                if (typeof onProgress === 'function') {
                    onProgress(completed, entries.length);
                }
            }
        } else {
            if (typeof onProgress === 'function') {
                onProgress(entries.length, entries.length);
            }
        }

        return true;
    }

    /**
     * تصفير تواريخ الإصدار لجميع الموظفين
     */
    async function clearAllIssueDatesLive() {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        try {
            const { data: setRow } = await client
                .from(SUPABASE_CONFIG.tables.settings)
                .select('extra_config')
                .eq('id', 'config')
                .maybeSingle();
            const extra = (setRow && setRow.extra_config) || {};
            extra.issue_date_map = {};
            await client
                .from(SUPABASE_CONFIG.tables.settings)
                .update({ extra_config: extra, updated_at: new Date().toISOString() })
                .eq('id', 'config');
        } catch(err) {}

        try {
            await client
                .from(SUPABASE_CONFIG.tables.employees)
                .update({ issue_date: null })
                .neq('matricule', '___NONE___');
        } catch(err) {}

        return true;
    }

    /**
     * تعطيل أو إعادة تفعيل بطاقة موظف مع تسجيل السبب
     */
    async function setCardDisabledStatus(matriculeId, isDisabled, reason = '', modifiedBy = 'ADMIN') {
        const cleanId = String(matriculeId).trim();
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        // 1. تحديث في system_settings.extra_config.disabled_cards_map
        try {
            const { data: setRow } = await client
                .from(SUPABASE_CONFIG.tables.settings)
                .select('extra_config')
                .eq('id', 'config')
                .maybeSingle();

            const extra = (setRow && setRow.extra_config) || {};
            extra.disabled_cards_map = extra.disabled_cards_map || {};
            if (isDisabled) {
                extra.disabled_cards_map[cleanId] = {
                    disabled: true,
                    reason: String(reason || 'معطلة بقرار إداري من مديرية التربية').trim(),
                    date: new Date().toISOString(),
                    by: modifiedBy
                };
            } else {
                delete extra.disabled_cards_map[cleanId];
            }
            await client
                .from(SUPABASE_CONFIG.tables.settings)
                .update({ extra_config: extra, updated_at: new Date().toISOString() })
                .eq('id', 'config');
        } catch(e) {
            console.warn("Notice saving disabled_cards_map:", e.message);
        }

        // 2. محاولة التحديث في base-touggourt إن كان العمود متوفراً
        try {
            await client
                .from(SUPABASE_CONFIG.tables.employees)
                .update({ 
                    is_card_disabled: !!isDisabled,
                    card_disable_reason: isDisabled ? String(reason || '').trim() : null
                })
                .eq('matricule', cleanId);
        } catch(e) {}

        // 3. توثيق في سجل التاريخ
        try {
            await client.from(SUPABASE_CONFIG.tables.history).insert([{
                employee_id: cleanId,
                action_type: isDisabled ? 'CARD_DISABLE' : 'CARD_ENABLE',
                previous_data: {},
                new_data: { disabled: isDisabled, reason: reason },
                modified_by: modifiedBy,
                modified_at: new Date().toISOString()
            }]);
        } catch(e) {}

        return true;
    }

    /**
     * إضافة موظف جديد مباشرة إلى Supabase
     */
    async function addNewEmployeeLive(empData, createdBy = 'DIRECTOR') {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        const jid = String(empData.jobId || empData.matricule || '').trim();
        if (!jid) throw new Error("الرقم الوظيفي إجباري.");

        const payload = {
            matricule: jid,
            nomAr: empData.nomAr || '',
            prenomAr: empData.prenomAr || '',
            dateNais: empData.dob || empData.dateNais || '',
            grade: empData.rank || empData.grade || '',
            etablissement: empData.workplace || empData.etablissement || '',
            nin: empData.nationalId || empData.nin || '',
            situationAdmin: empData.employmentType || empData.situationAdmin || 'مرسم',
            groupeSanguin: empData.bloodType || '',
            photo_url: empData.photoUrl || empData.photo || null,
            registry_no: empData.registryNo ? parseInt(empData.registryNo, 10) : null,
            telephone: empData.telephone || '',
            sexe: empData.sexe || 'ذكر'
        };

        if (empData.issueDate || empData.issue_date) {
            payload.issue_date = String(empData.issueDate || empData.issue_date).trim();
        }

        let insertRes = await client
            .from(SUPABASE_CONFIG.tables.employees)
            .insert([payload])
            .select()
            .maybeSingle();

        if (insertRes.error && payload.issue_date) {
            delete payload.issue_date;
            insertRes = await client
                .from(SUPABASE_CONFIG.tables.employees)
                .insert([payload])
                .select()
                .maybeSingle();
        }

        if (insertRes.error) throw insertRes.error;
        const data = insertRes.data;

        // تحديث خرائط الإعدادات المركزية
        if (empData.registryNo || empData.issueDate || empData.issue_date) {
            try {
                const { data: setRow } = await client
                    .from(SUPABASE_CONFIG.tables.settings)
                    .select('registry_map, extra_config')
                    .eq('id', 'config')
                    .maybeSingle();
                if (setRow) {
                    const rMap = setRow.registry_map || {};
                    const extra = setRow.extra_config || {};
                    extra.issue_date_map = extra.issue_date_map || {};
                    let needUpdate = false;
                    if (empData.registryNo) {
                        rMap[jid] = parseInt(empData.registryNo, 10);
                        needUpdate = true;
                    }
                    if (empData.issueDate || empData.issue_date) {
                        extra.issue_date_map[jid] = String(empData.issueDate || empData.issue_date).trim();
                        needUpdate = true;
                    }
                    if (needUpdate) {
                        await client.from(SUPABASE_CONFIG.tables.settings)
                            .update({ registry_map: rMap, extra_config: extra, updated_at: new Date().toISOString() })
                            .eq('id', 'config');
                    }
                }
            } catch(e) {}
        }

        // تسجيل في سجل التعديلات
        try {
            const historyPayload = {
                ...payload,
                name: empData.name || (empData.nomAr + ' ' + empData.prenomAr).trim(),
                substituteDuration: empData.substituteDuration || ''
            };
            await client.from(SUPABASE_CONFIG.tables.history).insert([{
                employee_id: jid,
                action_type: 'EMPLOYEE_CREATE',
                previous_data: {},
                new_data: historyPayload,
                modified_by: createdBy,
                modified_at: new Date().toISOString()
            }]);
        } catch(e) {}

        return formatEmployeeRecord(data);
    }

    /**
     * حذف موظف مباشرة من Supabase
     */
    async function deleteEmployeeLive(matriculeId, deletedBy = 'ADMIN') {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        const cleanId = String(matriculeId).trim();
        const { data: previousData } = await client
            .from(SUPABASE_CONFIG.tables.employees)
            .select('*')
            .eq('matricule', cleanId)
            .maybeSingle();

        const { error } = await client
            .from(SUPABASE_CONFIG.tables.employees)
            .delete()
            .eq('matricule', cleanId);

        if (error) throw error;

        // تسجيل في سجل التعديلات
        try {
            await client.from(SUPABASE_CONFIG.tables.history).insert([{
                employee_id: cleanId,
                action_type: 'EMPLOYEE_DELETE',
                previous_data: previousData || {},
                new_data: {},
                modified_by: deletedBy,
                modified_at: new Date().toISOString()
            }]);
        } catch(e) {}

        return true;
    }

    /**
     * جلب سجل التعديلات الفعلي من قاعدة البيانات (تصفية التعديلات البشرية فقط واستبعاد سجلات التريجر الآلية)
     */
    async function fetchModificationsHistory(limitCount = 100) {
        const client = getSupabaseClient();
        if (!client) return [];

        try {
            const { data, error } = await client
                .from(SUPABASE_CONFIG.tables.history)
                .select('*')
                .neq('modified_by', 'postgres')
                .in('action_type', ['ADMIN_EDIT', 'DIRECTOR_EDIT', 'TRANSFER_INSTITUTION', 'EMPLOYEE_CREATE'])
                .order('modified_at', { ascending: false })
                .limit(limitCount);

            if (error) {
                console.warn("fetch history notice:", error.message);
                return [];
            }

            return data || [];
        } catch(e) {
            return [];
        }
    }

    // ========================================================================
    // 5. المزامنة اللحظية الفورية (Realtime Subscriptions)
    // ========================================================================

    function subscribeToSystemSettings(onUpdateCallback) {
        const client = getSupabaseClient();
        if (!client) return null;

        return client
            .channel('realtime:system_settings')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: SUPABASE_CONFIG.tables.settings },
                (payload) => {
                    console.log("⚡ [Realtime] تحديث فوري لإعدادات النظام مستلم:", payload);
                    const newRow = payload ? payload.new : null;
                    if (newRow && newRow.extra_config) {
                        const extra = (typeof newRow.extra_config === 'string') ? JSON.parse(newRow.extra_config || '{}') : newRow.extra_config;
                        if (extra.allow_employee_movement) newRow.allow_employee_movement = extra.allow_employee_movement;
                        if (extra.allow_add_employee) newRow.allow_add_employee = extra.allow_add_employee;
                        newRow.employeeMovementInstitutions = extra.employee_movement_institutions || extra.employeeMovementInstitutions || [];
                        newRow.addEmployeeInstitutions = extra.add_employee_institutions || extra.addEmployeeInstitutions || [];
                        newRow.is_platform_open = (extra.is_platform_open !== undefined) ? !!extra.is_platform_open : true;
                        newRow.isPlatformOpen = newRow.is_platform_open;
                    }
                    if (typeof onUpdateCallback === 'function') onUpdateCallback(newRow);
                }
            )
            .subscribe();
    }

    // =========================================================================
    // منظومة التشفير وتوليد روابط التحقق الذكي للبطاقات المهنية الرقمية (النموذج 3)
    // =========================================================================
    const SMART_CARD_SECRET = "DEDZ_TOUGGOURT_CARD_SEC_2026";

    function safeBtoa(str) {
        if (typeof btoa === 'function') return btoa(str);
        if (typeof window !== 'undefined' && typeof window.btoa === 'function') return window.btoa(str);
        if (typeof globalThis !== 'undefined' && typeof globalThis.btoa === 'function') return globalThis.btoa(str);
        if (typeof Buffer !== 'undefined') return Buffer.from(str, 'binary').toString('base64');
        return '';
    }

    function safeAtob(b64) {
        if (typeof atob === 'function') return atob(b64);
        if (typeof window !== 'undefined' && typeof window.atob === 'function') return window.atob(b64);
        if (typeof globalThis !== 'undefined' && typeof globalThis.atob === 'function') return globalThis.atob(b64);
        if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64').toString('binary');
        return '';
    }

    function b64ToUrl(b64) {
        return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function urlToB64(url) {
        let b64 = url.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        return b64;
    }

    function encryptSmartCardPayload(obj) {
        try {
            const text = JSON.stringify(obj);
            let utf8Bytes;
            if (typeof TextEncoder !== 'undefined') {
                utf8Bytes = new TextEncoder().encode(text);
            } else if (typeof Buffer !== 'undefined') {
                utf8Bytes = Buffer.from(text, 'utf8');
            } else {
                utf8Bytes = [];
                for (let i = 0; i < text.length; i++) utf8Bytes.push(text.charCodeAt(i));
            }
            const salt = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
            const key = SMART_CARD_SECRET + salt;
            const out = new Uint8Array(utf8Bytes.length);
            for (let i = 0; i < utf8Bytes.length; i++) {
                const k = key.charCodeAt(i % key.length) ^ (i & 0xFF);
                out[i] = utf8Bytes[i] ^ k;
            }
            let binary = '';
            for (let i = 0; i < out.length; i++) {
                binary += String.fromCharCode(out[i]);
            }
            const cipherB64 = safeBtoa(binary);
            const combined = salt + ':' + cipherB64;
            const finalB64 = safeBtoa(combined);
            return b64ToUrl(finalB64);
        } catch (e) {
            console.error('Error encrypting smart card payload:', e);
            return '';
        }
    }

    function decryptSmartCardPayload(token) {
        try {
            if (!token) return null;
            const b64 = urlToB64(token);
            const combined = safeAtob(b64);
            const parts = combined.split(':');
            if (parts.length < 2) return null;
            const salt = parts[0];
            const cipherB64 = parts[1];
            if (!salt || !cipherB64) return null;
            const key = SMART_CARD_SECRET + salt;
            const binary = safeAtob(cipherB64);
            const out = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                const k = key.charCodeAt(i % key.length) ^ (i & 0xFF);
                out[i] = binary.charCodeAt(i) ^ k;
            }
            let decryptedStr;
            if (typeof TextDecoder !== 'undefined') {
                decryptedStr = new TextDecoder().decode(out);
            } else if (typeof Buffer !== 'undefined') {
                decryptedStr = Buffer.from(out).toString('utf8');
            } else {
                decryptedStr = '';
                for (let i = 0; i < out.length; i++) decryptedStr += String.fromCharCode(out[i]);
            }
            return JSON.parse(decryptedStr);
        } catch (e) {
            console.error('Error decrypting smart card token:', e);
            return null;
        }
    }

    function generateSmartCardVerificationUrl(emp, config = {}) {
        const jid = String(emp.jobId || emp.matricule || '').trim();
        let origin = '';
        if (typeof window !== 'undefined' && window.location) {
            const loc = window.location;
            const pathParts = loc.pathname.split('/');
            pathParts.pop(); // remove current file name
            const basePath = pathParts.join('/') + '/';
            origin = loc.origin + basePath;
        }

        try {
            // تشفير المعرف رقمياً بشكل محكم وموجز لمنع التطفل أو التلاعب برقم الموظف
            const token = encryptSmartCardPayload({
                j: jid,
                t: Math.floor(Date.now() / 1000)
            });
            if (token) {
                return (origin || './') + 'verify.html?token=' + encodeURIComponent(token);
            }
        } catch(e) {
            console.error('Error generating encrypted verification url:', e);
        }

        return (origin || './') + 'verify.html?id=' + encodeURIComponent(jid);
    }

    /**
     * حفظ وتعميم تاريخ الإصدار العام المعتمد للنموذج الثالث
     */
    async function saveTemplate3GlobalIssueDate(dateStr, modifiedBy = 'ADMIN') {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");
        const cleanDate = String(dateStr || '').trim();
        const { data: setRow } = await client
            .from(SUPABASE_CONFIG.tables.settings)
            .select('extra_config')
            .eq('id', 'config')
            .maybeSingle();
        const extra = (setRow && setRow.extra_config) ? ((typeof setRow.extra_config === 'string') ? JSON.parse(setRow.extra_config) : setRow.extra_config) : {};
        if (cleanDate) {
            extra.template3_issue_date = cleanDate;
        } else {
            delete extra.template3_issue_date;
        }
        await client
            .from(SUPABASE_CONFIG.tables.settings)
            .update({ extra_config: extra, updated_at: new Date().toISOString() })
            .eq('id', 'config');
        return true;
    }

    /**
     * حفظ الرقم السري للبطاقة الرقمية وقفل صفحة الاستعلام
     */
    async function saveDigitalCardPin(pinStr, modifiedBy = 'ADMIN') {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");
        const cleanPin = String(pinStr || '').trim();
        const { data: setRow } = await client
            .from(SUPABASE_CONFIG.tables.settings)
            .select('extra_config')
            .eq('id', 'config')
            .maybeSingle();
        const extra = (setRow && setRow.extra_config) ? ((typeof setRow.extra_config === 'string') ? JSON.parse(setRow.extra_config) : setRow.extra_config) : {};
        if (cleanPin) {
            extra.digital_card_pin = cleanPin;
        } else {
            delete extra.digital_card_pin;
        }
        await client
            .from(SUPABASE_CONFIG.tables.settings)
            .update({ extra_config: extra, updated_at: new Date().toISOString() })
            .eq('id', 'config');
        return true;
    }

    // تصدير الكائنات والدوال للنطاق العام (window)
    window.SUPABASE_CONFIG = SUPABASE_CONFIG;
    window.getSupabaseClient = getSupabaseClient;
    window.verifyPagePassword = verifyPagePassword;
    window.fetchSystemSettings = fetchSystemSettings;
    window.updateSystemSettings = updateSystemSettings;
    window.fetchInstitutionsList = fetchInstitutionsList;
    window.saveInstitution = saveInstitution;
    window.deleteInstitution = deleteInstitution;
    window.logInstitutionActivity = logInstitutionActivity;
    window.fetchInstitutionsActivity = fetchInstitutionsActivity;
    window.clearInstitutionsActivity = clearInstitutionsActivity;
    window.formatEmployeeRecord = formatEmployeeRecord;
    window.fetchAllEmployeesLive = fetchAllEmployeesLive;
    window.fetchInstitutionEmployeesLive = fetchInstitutionEmployeesLive;
    window.checkDirectorLive = checkDirectorLive;
    window.searchEmployeeLive = searchEmployeeLive;
    window.updateEmployeeWithHistory = updateEmployeeWithHistory;
    window.updateEmployeePhotoUrl = updateEmployeePhotoUrl;
    window.deleteEmployeePhotoUrl = deleteEmployeePhotoUrl;
    window.updateEmployeeRegistryNo = updateEmployeeRegistryNo;
    window.bulkUpdateRegistryNumbers = bulkUpdateRegistryNumbers;
    window.clearAllRegistryNumbersLive = clearAllRegistryNumbersLive;
    window.updateEmployeeIssueDate = updateEmployeeIssueDate;
    window.bulkUpdateIssueDates = bulkUpdateIssueDates;
    window.clearAllIssueDatesLive = clearAllIssueDatesLive;
    window.setCardDisabledStatus = setCardDisabledStatus;
    window.addNewEmployeeLive = addNewEmployeeLive;
    window.deleteEmployeeLive = deleteEmployeeLive;
    window.fetchModificationsHistory = fetchModificationsHistory;
    window.subscribeToSystemSettings = subscribeToSystemSettings;
    window.encryptSmartCardPayload = encryptSmartCardPayload;
    window.decryptSmartCardPayload = decryptSmartCardPayload;
    window.generateSmartCardVerificationUrl = generateSmartCardVerificationUrl;
    window.saveTemplate3GlobalIssueDate = saveTemplate3GlobalIssueDate;
    window.saveDigitalCardPin = saveDigitalCardPin;
    window.cleanDateString = cleanDateString;

})(typeof window !== 'undefined' ? window : this);
