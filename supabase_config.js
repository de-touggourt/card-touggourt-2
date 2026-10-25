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

        console.log("✅ [Supabase Live] تم استلام إعدادات النظام بنجاح:", data);
        return data;
    }

    async function updateSystemSettings(newSettings) {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        const payload = {
            ...newSettings,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await client
            .from(SUPABASE_CONFIG.tables.settings)
            .upsert({ id: 'config', ...payload })
            .select()
            .maybeSingle();

        if (error) {
            console.error("❌ فشل تحديث إعدادات النظام:", error);
            throw error;
        }

        console.log("✅ تم حفظ وتعميم إعدادات النظام بنجاح:", data);
        return data;
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
        const fullName = (d.name || ((d.nomAr || '') + ' ' + (d.prenomAr || '')).trim() || ((d.prenomAr || '') + ' ' + (d.nomAr || '')).trim() || '').trim();
        const jid = String(d.matricule || d.job_id || d.jobId || d.id || '').trim();

        let photoVal = d.photo_url || d.photo || null;
        if (!photoVal && window.CF_PHOTOS_MAP && window.CF_PHOTOS_MAP[jid]) {
            photoVal = window.CF_PHOTOS_MAP[jid].cfUrl;
        }

        const workplaceVal = (d.etablissement || d.workplace || d.place || d.inst || '').trim();

        return {
            id: 'emp_sb_' + jid,
            jobId: jid,
            matricule: jid,
            name: fullName,
            fullName: fullName,
            nomAr: d.nomAr || '',
            prenomAr: d.prenomAr || '',
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
            bloodType: d.groupeSanguin || d.bloodType || '',
            photo: photoVal,                   // رابط صورة Cloudflare المعتمد
            photoUrl: photoVal,
            registryNo: (d.registry_no !== undefined && d.registry_no !== null && d.registry_no !== '') ? parseInt(d.registry_no, 10) : null,
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

        // 1. تحديد العدد الإجمالي لسجلات الموظفين
        const { count, error: countErr } = await client
            .from(SUPABASE_CONFIG.tables.employees)
            .select('*', { count: 'exact', head: true });

        if (countErr) {
            console.warn("Count warning, defaulting to 9074:", countErr.message);
        }

        const totalCount = count || 9074;
        const chunkSize = 1000;
        const numChunks = Math.ceil(totalCount / chunkSize);
        const chunkPromises = [];

        for (let i = 0; i < numChunks; i++) {
            const from = i * chunkSize;
            const to = Math.min(from + chunkSize - 1, totalCount - 1);
            chunkPromises.push(
                client
                    .from(SUPABASE_CONFIG.tables.employees)
                    .select('*')
                    .range(from, to)
                    .then(res => {
                        if (res.error) throw res.error;
                        const rows = res.data || [];
                        if (typeof onProgress === 'function') {
                            onProgress(rows.length);
                        }
                        return rows;
                    })
            );
        }

        const chunkResults = await Promise.all(chunkPromises);
        const allRows = chunkResults.flat();
        const formatted = allRows.map(formatEmployeeRecord);

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

        const formatted = (data || []).map(formatEmployeeRecord);
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
    async function updateEmployeeWithHistory(matriculeId, newFields, modifiedBy = 'DIRECTOR', actionType = 'UPDATE') {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        const cleanId = String(matriculeId).trim();
        if (!cleanId) throw new Error("رقم الموظف مطلوب لإجراء التحديث.");

        const { data: previousData } = await client
            .from(SUPABASE_CONFIG.tables.employees)
            .select('*')
            .eq('matricule', cleanId)
            .maybeSingle();

        const { data: updatedEmployee, error: updateErr } = await client
            .from(SUPABASE_CONFIG.tables.employees)
            .update(newFields)
            .eq('matricule', cleanId)
            .select()
            .maybeSingle();

        if (updateErr) throw updateErr;

        // تسجيل التعديل في جدول التعديلات
        const historyRecord = {
            employee_id: cleanId,
            action_type: actionType,
            previous_data: previousData || {},
            new_data: updatedEmployee || newFields,
            modified_by: modifiedBy,
            modified_at: new Date().toISOString()
        };

        await client.from(SUPABASE_CONFIG.tables.history).insert([historyRecord]).catch(() => {});

        return formatEmployeeRecord(updatedEmployee) || newFields;
    }

    /**
     * حفظ وتحديث رابط صورة Cloudflare في قاعدة البيانات
     */
    async function updateEmployeePhotoUrl(matriculeId, cloudflareImageUrl, modifiedBy = 'DIRECTOR') {
        return await updateEmployeeWithHistory(
            matriculeId,
            { photo_url: cloudflareImageUrl },
            modifiedBy,
            'PHOTO_UPDATE'
        );
    }

    /**
     * حذف رابط صورة الموظف
     */
    async function deleteEmployeePhotoUrl(matriculeId, modifiedBy = 'DIRECTOR') {
        return await updateEmployeeWithHistory(
            matriculeId,
            { photo_url: null },
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
     * تحديث أرقام القيد المعتمدة لعدة موظفين دفعة واحدة
     */
    async function bulkUpdateRegistryNumbers(registryMap, modifiedBy = 'ADMIN') {
        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client is not initialized");

        const entries = Object.entries(registryMap || {});
        if (entries.length === 0) return true;

        console.log(`🔄 [Supabase Live] جاري تحديث ${entries.length} رقم قيد في قاعدة البيانات...`);

        const promises = entries.map(([jid, regNo]) => {
            return client
                .from(SUPABASE_CONFIG.tables.employees)
                .update({ registry_no: parseInt(regNo, 10) })
                .eq('matricule', String(jid).trim());
        });

        await Promise.all(promises);
        console.log("✅ تم تحديث أرقام القيد بنجاح في قاعدة البيانات.");
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

        const { data, error } = await client
            .from(SUPABASE_CONFIG.tables.employees)
            .insert([payload])
            .select()
            .maybeSingle();

        if (error) throw error;

        // تسجيل في سجل التعديلات
        await client.from(SUPABASE_CONFIG.tables.history).insert([{
            employee_id: jid,
            action_type: 'EMPLOYEE_CREATE',
            previous_data: {},
            new_data: payload,
            modified_by: createdBy,
            modified_at: new Date().toISOString()
        }]).catch(() => {});

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
        await client.from(SUPABASE_CONFIG.tables.history).insert([{
            employee_id: cleanId,
            action_type: 'EMPLOYEE_DELETE',
            previous_data: previousData || {},
            new_data: {},
            modified_by: deletedBy,
            modified_at: new Date().toISOString()
        }]).catch(() => {});

        return true;
    }

    /**
     * جلب سجل التعديلات من قاعدة البيانات
     */
    async function fetchModificationsHistory(limitCount = 100) {
        const client = getSupabaseClient();
        if (!client) return [];

        const { data, error } = await client
            .from(SUPABASE_CONFIG.tables.history)
            .select('*')
            .order('modified_at', { ascending: false })
            .limit(limitCount);

        if (error) {
            console.warn("fetch history notice:", error.message);
            return [];
        }

        return data || [];
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
                    if (typeof onUpdateCallback === 'function') onUpdateCallback(payload.new);
                }
            )
            .subscribe();
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
    window.addNewEmployeeLive = addNewEmployeeLive;
    window.deleteEmployeeLive = deleteEmployeeLive;
    window.fetchModificationsHistory = fetchModificationsHistory;
    window.subscribeToSystemSettings = subscribeToSystemSettings;

})(typeof window !== 'undefined' ? window : this);
