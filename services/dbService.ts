import { supabase, isSupabaseConfigured } from './supabaseClient';
import type {
    AdminUserSummary,
    Biomarkers,
    ClinicalAnalysis,
    DailyLogRecord,
    HealthData,
    NutritionalAnalysis,
    NutritionScores,
    NutriScore,
    SmokingStatus,
    UserActionLog,
    UserProfile,
    UserRole,
    VigsAssessmentRecord,
    VigsCategory,
    VigsScore,
} from '../types';

const isDemo = !isSupabaseConfigured;

const getErrorMessage = (error: any): string => {
    if (!error) return 'Error desconocido';
    if (typeof error === 'string') return error;
    if (error.message) {
        if (error.message.includes('row-level security') || error.code === '42501') {
            return 'Error de permisos (RLS): No tienes permiso para realizar esta operación.';
        }
        return error.message;
    }
    return JSON.stringify(error);
};

const shouldRetryWithoutAdvancedColumns = (error: any): boolean => {
    const message = getErrorMessage(error).toLowerCase();
    return (
        message.includes('column') ||
        message.includes('schema cache') ||
        message.includes('updated_by') ||
        message.includes('created_by') ||
        message.includes('updated_at') ||
        message.includes('role') ||
        message.includes('active')
    );
};

const getCategoryFromIndex = (index: number): VigsCategory => {
    if (index < 0.20) return 'No frágil';
    if (index <= 0.37) return 'Fragilidad leve';
    if (index <= 0.54) return 'Fragilidad moderada';
    return 'Fragilidad severa';
};

const serializeAuditValue = (value: unknown): string | null => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
};

const parseNumberOrNull = (value: string | number | null | undefined): number | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    const cleanedValue = value.trim().replace(',', '.').replace(/[^0-9.-]/g, '');
    if (!cleanedValue || cleanedValue === '-' || cleanedValue === '.') return null;

    const parsedValue = Number.parseFloat(cleanedValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
};

const mapVigsAnswersToDb = (answers: Record<string, number>) => {
    const totalPoints = Object.values(answers).reduce((sum, val) => sum + val, 0);
    const index = totalPoints / 25.0;

    return {
        totalPoints,
        index,
        dbData: {
            ayuda_dinero: answers.dinero > 0,
            ayuda_telefono: answers.telefono > 0,
            ayuda_medicacion: answers.medicacion > 0,
            barthel_grado: Math.min(3, Math.max(0, answers.barthel || 0)),
            perdida_peso_6m: answers.malnutricion > 0,
            deterioro_cognitivo_grado: Math.min(2, Math.max(0, answers.deterioro_cognitivo || 0)),
            usa_antidepresivos: answers.depresion > 0,
            usa_psicofarmacos: answers.ansiedad > 0,
            vulnerabilidad_social: answers.vulnerabilidad > 0,
            presenta_delirium: answers.confusional > 0,
            caidas_recuentes: answers.caidas > 0,
            presenta_ulceras: answers.ulceras > 0,
            polifarmacia: answers.polifarmacia > 0,
            presenta_disfagia: answers.disfagia > 0,
            dolor_control_dificil: answers.dolor > 0,
            disnea_basal: answers.disnea > 0,
            enf_oncologica: Math.min(2, Math.max(0, answers.cancer || 0)),
            enf_respiratoria: Math.min(2, Math.max(0, answers.respiratoria || 0)),
            enf_cardiaca: Math.min(2, Math.max(0, answers.cardiaca || 0)),
            enf_neurodegenerativa: Math.min(2, Math.max(0, answers.neurologica || 0)),
            enf_digestiva: Math.min(2, Math.max(0, answers.digestiva || 0)),
            enf_renal_cronica: Math.min(2, Math.max(0, answers.renal || 0)),
            puntos_totales: totalPoints,
            indice_vig_resultado: index,
        },
    };
};

const mapHealthDataToDb = (healthData: Partial<HealthData>) => {
    const dbData: Record<string, number | null> = {};
    if (healthData.weight !== undefined) dbData.peso_kg = healthData.weight;
    if (healthData.systolicBP !== undefined) dbData.tas_mmhg = healthData.systolicBP === null ? null : Math.round(healthData.systolicBP);
    if (healthData.diastolicBP !== undefined) dbData.tad_mmhg = healthData.diastolicBP === null ? null : Math.round(healthData.diastolicBP);
    if (healthData.pulse !== undefined) dbData.frec_cardiaca_lpm = healthData.pulse === null ? null : Math.round(healthData.pulse);
    if (healthData.oxygenSaturation !== undefined) dbData.sat_o2_pct = healthData.oxygenSaturation;
    if (healthData.glucose !== undefined) dbData.glucosa_mgdl = healthData.glucose;
    if (healthData.falls !== undefined) dbData.caidas_detectadas = healthData.falls;
    if (healthData.calfCircumference !== undefined) dbData.pantorrilla_cm = healthData.calfCircumference;
    if (healthData.abdominalCircumference !== undefined) dbData.abdomen_cm = healthData.abdominalCircumference;
    return dbData;
};

const mapDbLogToRecord = (data: any): DailyLogRecord => ({
    id: data.id,
    userId: data.user_id,
    weight: data.peso_kg ?? null,
    systolicBP: data.tas_mmhg ?? null,
    diastolicBP: data.tad_mmhg ?? null,
    pulse: data.frec_cardiaca_lpm ?? null,
    oxygenSaturation: data.sat_o2_pct ?? null,
    glucose: data.glucosa_mgdl ?? null,
    falls: data.caidas_detectadas ?? null,
    calfCircumference: data.pantorrilla_cm ?? null,
    abdominalCircumference: data.abdomen_cm ?? null,
    createdAt: new Date(data.created_at),
    updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
});

const stripAdvancedUserColumns = (data: Record<string, any>) => {
    const { role, active, updated_at, created_by, updated_by, ...legacyData } = data;
    return legacyData;
};

const mapProfileToDb = (profile: Partial<UserProfile>, actorUserId?: string) => {
    const dbData: Record<string, any> = {};
    if (profile.email !== undefined) dbData.email = profile.email;
    if (profile.displayName !== undefined) dbData.nombre_usuario = profile.displayName;
    if (profile.age !== undefined) dbData.edad = profile.age;
    if (profile.gender !== undefined) dbData.sexo = profile.gender;
    if (profile.nationality !== undefined) dbData.nacionalidad = profile.nationality;
    if (profile.language !== undefined) dbData.idioma = profile.language;
    if (profile.emergencyContactName !== undefined) dbData.contacto_emergencia_nombre = profile.emergencyContactName;
    if (profile.emergencyContactPhone !== undefined) dbData.contacto_emergencia_telefono = profile.emergencyContactPhone;
    if (profile.avatarId !== undefined) dbData.avatar_id = profile.avatarId;
    if (profile.diaryPreferences !== undefined) dbData.diary_preferences = profile.diaryPreferences;
    if (profile.alerts !== undefined) dbData.alerts_json = profile.alerts;
    if (profile.smokingStatus !== undefined) dbData.smoking_status = profile.smokingStatus;
    if (profile.nutritionalScore !== undefined) dbData.nutritional_score = profile.nutritionalScore;
    if (profile.points !== undefined) dbData.points = profile.points;
    if (profile.level !== undefined) dbData.level = profile.level;
    if (profile.role !== undefined) dbData.role = profile.role;
    if (profile.active !== undefined) dbData.active = profile.active;
    if (profile.healthData?.height !== undefined) dbData.talla_cm = profile.healthData.height;

    dbData.updated_at = new Date().toISOString();
    if (actorUserId) dbData.updated_by = actorUserId;

    return dbData;
};

const mapDbToProfile = (data: any, latestLog?: any, latestVigs?: any): UserProfile => {
    const index = latestVigs?.indice_vig_resultado ?? 0;
    return {
        email: data.email || '',
        displayName: data.nombre_usuario || 'Usuario',
        age: data.edad || 75,
        gender: data.sexo || 'male',
        nationality: data.nacionalidad || 'Española',
        language: data.idioma || 'Español',
        emergencyContactName: data.contacto_emergencia_nombre || '',
        emergencyContactPhone: data.contacto_emergencia_telefono || '',
        diaryPreferences: data.diary_preferences || ['weight', 'systolicBP', 'diastolicBP', 'pulse', 'glucose'],
        hasLegalConsent: true,
        dataProcessingConsent: true,
        avatarId: data.avatar_id || 0,
        smokingStatus: (data.smoking_status as SmokingStatus) || 'Nunca',
        nutritionalScore: data.nutritional_score || 0,
        points: data.points || 0,
        level: data.level || 1,
        role: (data.role as UserRole) || 'patient',
        active: data.active ?? true,
        createdAt: data.created_at ? new Date(data.created_at) : undefined,
        updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
        createdBy: data.created_by ?? null,
        updatedBy: data.updated_by ?? null,
        healthData: {
            weight: latestLog?.peso_kg ?? null,
            systolicBP: latestLog?.tas_mmhg ?? null,
            diastolicBP: latestLog?.tad_mmhg ?? null,
            pulse: latestLog?.frec_cardiaca_lpm ?? null,
            oxygenSaturation: latestLog?.sat_o2_pct ?? null,
            glucose: latestLog?.glucosa_mgdl ?? null,
            falls: latestLog?.caidas_detectadas ?? null,
            calfCircumference: latestLog?.pantorrilla_cm ?? null,
            abdominalCircumference: latestLog?.abdomen_cm ?? null,
            height: data.talla_cm || 170,
        },
        vigsScore: {
            score: latestVigs?.puntos_totales ?? 0,
            category: getCategoryFromIndex(index),
            index,
        },
        alerts: data.alerts_json || [],
    };
};

const insertUserRow = async (payload: Record<string, any>) => {
    const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
    if (error && shouldRetryWithoutAdvancedColumns(error)) {
        const { error: legacyError } = await supabase.from('users').upsert(stripAdvancedUserColumns(payload), { onConflict: 'id' });
        if (legacyError) throw new Error(getErrorMessage(legacyError));
        return;
    }
    if (error) throw new Error(getErrorMessage(error));
};

export const logUserAction = async (userId: string, actionType: string, description?: string): Promise<void> => {
    if (isDemo || !userId) return;
    try {
        const { error } = await supabase.from('user_action_log').insert({
            user_id: userId,
            action_type: actionType,
            description: description || null,
        });
        if (error) {
            console.warn('[LOG] No se pudo registrar la acción:', getErrorMessage(error));
        }
    } catch (error) {
        console.warn('[LOG] Error no bloqueante registrando acción:', error);
    }
};

export const auditUserChange = async (
    userId: string,
    modifiedBy: string,
    fieldName: string,
    oldValue: unknown,
    newValue: unknown,
): Promise<void> => {
    if (isDemo) return;
    try {
        const { error } = await supabase.from('user_audit').insert({
            user_id: userId,
            modified_by: modifiedBy,
            field_name: fieldName,
            old_value: serializeAuditValue(oldValue),
            new_value: serializeAuditValue(newValue),
        });
        if (error) {
            console.warn('[AUDIT] No se pudo auditar el usuario:', getErrorMessage(error));
        }
    } catch (error) {
        console.warn('[AUDIT] Error no bloqueante auditando usuario:', error);
    }
};

export const auditDailyLogChange = async (
    dailyLogId: string,
    modifiedBy: string,
    fieldName: string,
    oldValue: unknown,
    newValue: unknown,
): Promise<void> => {
    if (isDemo) return;
    try {
        const { error } = await supabase.from('daily_logs_audit').insert({
            daily_log_id: dailyLogId,
            modified_by: modifiedBy,
            field_name: fieldName,
            old_value: serializeAuditValue(oldValue),
            new_value: serializeAuditValue(newValue),
        });
        if (error) {
            console.warn('[AUDIT] No se pudo auditar el diario:', getErrorMessage(error));
        }
    } catch (error) {
        console.warn('[AUDIT] Error no bloqueante auditando diario:', error);
    }
};

export const auditVigsAssessmentChange = async (
    assessmentId: string,
    modifiedBy: string,
    fieldName: string,
    oldValue: unknown,
    newValue: unknown,
): Promise<void> => {
    if (isDemo) return;
    try {
        const { error } = await supabase.from('vigs_assessment_audit').insert({
            assessment_id: assessmentId,
            modified_by: modifiedBy,
            field_name: fieldName,
            old_value: serializeAuditValue(oldValue),
            new_value: serializeAuditValue(newValue),
        });
        if (error) {
            console.warn('[AUDIT] No se pudo auditar la evaluación VIG:', getErrorMessage(error));
        }
    } catch (error) {
        console.warn('[AUDIT] Error no bloqueante auditando VIG:', error);
    }
};

export const auditClinicalReportChange = async (
    reportId: string,
    modifiedBy: string,
    fieldName: string,
    oldValue: unknown,
    newValue: unknown,
): Promise<void> => {
    if (isDemo) return;
    try {
        const { error } = await supabase.from('clinical_reports_audit').insert({
            report_id: reportId,
            modified_by: modifiedBy,
            field_name: fieldName,
            old_value: serializeAuditValue(oldValue),
            new_value: serializeAuditValue(newValue),
        });
        if (error) {
            console.warn('[AUDIT] No se pudo auditar el informe clínico:', getErrorMessage(error));
        }
    } catch (error) {
        console.warn('[AUDIT] Error no bloqueante auditando informe clínico:', error);
    }
};

export const auditNutritionLogChange = async (
    logId: string,
    modifiedBy: string,
    fieldName: string,
    oldValue: unknown,
    newValue: unknown,
): Promise<void> => {
    if (isDemo) return;
    try {
        const { error } = await supabase.from('nutrition_logs_audit').insert({
            nutrition_log_id: logId,
            modified_by: modifiedBy,
            field_name: fieldName,
            old_value: serializeAuditValue(oldValue),
            new_value: serializeAuditValue(newValue),
        });
        if (error) {
            console.warn('[AUDIT] No se pudo auditar el registro nutricional:', getErrorMessage(error));
        }
    } catch (error) {
        console.warn('[AUDIT] Error no bloqueante auditando nutrición:', error);
    }
};

export const initializeUser = async (uid: string, email: string): Promise<UserProfile> => {
    if (isDemo) return mapDbToProfile({ email, nombre_usuario: 'Usuario Demo' });

    const { data: user } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
    if (!user) {
        const defaultProfile: UserProfile = {
            email,
            displayName: 'Nuevo Usuario',
            age: 75,
            gender: 'male',
            nationality: 'Española',
            language: 'Español',
            emergencyContactName: '',
            emergencyContactPhone: '',
            hasLegalConsent: true,
            dataProcessingConsent: true,
            avatarId: 0,
            diaryPreferences: ['weight', 'systolicBP', 'diastolicBP', 'pulse', 'glucose'],
            healthData: {
                weight: null,
                falls: null,
                systolicBP: null,
                diastolicBP: null,
                pulse: null,
                oxygenSaturation: null,
                glucose: null,
                calfCircumference: null,
                abdominalCircumference: null,
                height: 170,
            },
            vigsScore: { score: 0, category: 'No frágil', index: 0 },
            alerts: [],
            smokingStatus: 'Nunca',
            nutritionalScore: 0,
            points: 0,
            level: 1,
            role: 'patient',
            active: true,
            createdBy: uid,
            updatedBy: uid,
        };
        await registerUserInDb(uid, defaultProfile, uid);
        return defaultProfile;
    }

    const { data: latestLog } = await supabase.from('daily_logs').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const { data: latestVigs } = await supabase.from('vigs_assessments').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(1).maybeSingle();
    return mapDbToProfile(user, latestLog, latestVigs);
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
    return initializeUser(uid, '');
};

export const updateUserProfile = async (uid: string, profile: Partial<UserProfile>, modifiedBy: string = uid): Promise<void> => {
    if (isDemo) return;

    const { data: existing } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
    const dbData = mapProfileToDb(profile, modifiedBy);
    await insertUserRow({ id: uid, ...dbData });

    if (existing) {
        const changedFields = Object.entries(dbData).filter(([key, newValue]) => {
            if (key === 'updated_at' || key === 'updated_by') return false;
            return serializeAuditValue(existing[key]) !== serializeAuditValue(newValue);
        });

        await Promise.all(
            changedFields.map(([key, newValue]) => auditUserChange(uid, modifiedBy, key, existing[key], newValue)),
        );
    }

    await logUserAction(modifiedBy, 'profile_updated', `Perfil actualizado: ${Object.keys(dbData).join(', ')}`);
};

export const saveVigsAssessment = async (uid: string, answers: Record<string, number>): Promise<void> => {
    if (isDemo) return;

    const { totalPoints, dbData } = mapVigsAnswersToDb(answers);
    const { data: createdAssessment, error } = await supabase.from('vigs_assessments').insert({
        user_id: uid,
        ...dbData,
    }).select('id').single();
    if (error) throw new Error(getErrorMessage(error));

    if (createdAssessment?.id) {
        try {
            const answerRows = Object.entries(answers).map(([questionKey, answerValue]) => ({
                assessment_id: createdAssessment.id,
                question_key: questionKey,
                answer_value: answerValue,
            }));
            const { error: answerError } = await supabase.from('assessment_answers').insert(answerRows);
            if (answerError) {
                console.warn('[VIG] No se pudieron guardar las respuestas detalladas:', getErrorMessage(answerError));
            }
        } catch (answerError) {
            console.warn('[VIG] Error no bloqueante guardando respuestas detalladas:', answerError);
        }
    }

    await logUserAction(uid, 'vig_created', `Evaluación VIG registrada con ${totalPoints} puntos.`);
};

const mapDbVigsAssessmentToRecord = (item: any): VigsAssessmentRecord => {
    const index = Number(item.indice_vig_resultado ?? 0);
    return {
        id: item.id,
        userId: item.user_id,
        score: Number(item.puntos_totales ?? 0),
        category: getCategoryFromIndex(index),
        index,
        createdAt: new Date(item.created_at),
    };
};

export const getVigsAssessments = async (userId: string): Promise<VigsAssessmentRecord[]> => {
    if (isDemo) return [];
    const { data, error } = await supabase
        .from('vigs_assessments')
        .select('id, user_id, puntos_totales, indice_vig_resultado, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw new Error(getErrorMessage(error));
    return (data || []).map(mapDbVigsAssessmentToRecord);
};

export const getVigsAssessmentAnswers = async (assessmentId: string): Promise<Record<string, number>> => {
    if (isDemo) return {};
    const { data, error } = await supabase
        .from('assessment_answers')
        .select('question_key, answer_value')
        .eq('assessment_id', assessmentId);

    if (error) throw new Error(getErrorMessage(error));
    return (data || []).reduce<Record<string, number>>((answers, item: any) => {
        answers[item.question_key] = Number(item.answer_value ?? 0);
        return answers;
    }, {});
};

export const updateVigsAssessment = async (
    assessmentId: string,
    userId: string,
    answers: Record<string, number>,
): Promise<VigsScore> => {
    const { totalPoints, index, dbData } = mapVigsAnswersToDb(answers);
    const updatedScore: VigsScore = {
        score: totalPoints,
        index,
        category: getCategoryFromIndex(index),
    };

    if (isDemo) return updatedScore;

    const { data: existingAssessment, error: existingError } = await supabase
        .from('vigs_assessments')
        .select('*')
        .eq('id', assessmentId)
        .eq('user_id', userId)
        .maybeSingle();

    if (existingError) throw new Error(getErrorMessage(existingError));
    if (!existingAssessment) throw new Error('No se encontró la evaluación VIG a corregir.');

    const { data: existingAnswerRows, error: answersError } = await supabase
        .from('assessment_answers')
        .select('id, question_key, answer_value')
        .eq('assessment_id', assessmentId);

    if (answersError) throw new Error(getErrorMessage(answersError));

    const { error: updateError } = await supabase
        .from('vigs_assessments')
        .update(dbData)
        .eq('id', assessmentId)
        .eq('user_id', userId);

    if (updateError) throw new Error(getErrorMessage(updateError));

    const previousAnswers = (existingAnswerRows || []).reduce<Record<string, { id: string; value: number }>>((acc, row) => {
        acc[row.question_key] = { id: row.id, value: Number(row.answer_value ?? 0) };
        return acc;
    }, {});

    for (const [questionKey, answerValue] of Object.entries(answers)) {
        const existingAnswer = previousAnswers[questionKey];
        if (existingAnswer) {
            const { error } = await supabase
                .from('assessment_answers')
                .update({ answer_value: answerValue })
                .eq('id', existingAnswer.id);
            if (error) throw new Error(getErrorMessage(error));
        } else {
            const { error } = await supabase.from('assessment_answers').insert({
                assessment_id: assessmentId,
                question_key: questionKey,
                answer_value: answerValue,
            });
            if (error) throw new Error(getErrorMessage(error));
        }
    }

    const changedAssessmentFields = Object.entries(dbData).filter(([key, newValue]) => (
        key === 'puntos_totales' ||
        key === 'indice_vig_resultado' ||
        serializeAuditValue(existingAssessment[key]) !== serializeAuditValue(newValue)
    )).filter(([key, newValue]) => serializeAuditValue(existingAssessment[key]) !== serializeAuditValue(newValue));

    const changedAnswerFields = Object.entries(answers).filter(([questionKey, answerValue]) => (
        serializeAuditValue(previousAnswers[questionKey]?.value ?? null) !== serializeAuditValue(answerValue)
    ));

    await Promise.all([
        ...changedAssessmentFields.map(([key, newValue]) => auditVigsAssessmentChange(assessmentId, userId, key, existingAssessment[key], newValue)),
        ...changedAnswerFields.map(([questionKey, answerValue]) => auditVigsAssessmentChange(
            assessmentId,
            userId,
            `answer_${questionKey}`,
            previousAnswers[questionKey]?.value ?? null,
            answerValue,
        )),
    ]);

    await logUserAction(userId, 'vig_updated', `Evaluación VIG corregida con ${totalPoints} puntos.`);
    return updatedScore;
};

export const getVigsHistory = async (uid: string): Promise<{ index: number; createdAt: Date }[]> => {
    const history = await getVigsAssessments(uid);
    return history.map((item) => ({ index: item.index, createdAt: item.createdAt }));
};

export const registerUserInDb = async (uid: string, profile: UserProfile, createdBy: string = uid): Promise<void> => {
    if (isDemo) return;

    const dbFields = mapProfileToDb(profile, createdBy);
    await insertUserRow({
        id: uid,
        created_by: createdBy,
        ...dbFields,
    });
};

export const saveDailyLog = async (uid: string, healthData: HealthData): Promise<void> => {
    if (isDemo) return;

    const { error } = await supabase.from('daily_logs').insert({
        user_id: uid,
        ...mapHealthDataToDb(healthData),
    });
    if (error) throw new Error(getErrorMessage(error));

    await logUserAction(uid, 'daily_log_created', 'Se ha creado un nuevo registro diario.');
};

export const getDailyHistory = async (uid: string): Promise<DailyLogRecord[]> => {
    if (isDemo) return [];
    const { data, error } = await supabase.from('daily_logs').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (error) throw new Error(getErrorMessage(error));
    return (data || []).map(mapDbLogToRecord);
};

export const updateDailyLog = async (
    logId: string,
    userId: string,
    updates: Partial<HealthData>,
    modifiedBy: string = userId,
): Promise<void> => {
    if (isDemo) return;

    const { data: existingLog, error: existingError } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('id', logId)
        .eq('user_id', userId)
        .maybeSingle();

    if (existingError) throw new Error(getErrorMessage(existingError));
    if (!existingLog) throw new Error('No se encontró el registro diario a corregir.');

    const dbUpdates = mapHealthDataToDb(updates);
    if (Object.keys(dbUpdates).length === 0) return;

    let updatePayload: Record<string, any> = { ...dbUpdates, updated_at: new Date().toISOString() };
    let updateError: any = null;

    const firstAttempt = await supabase.from('daily_logs').update(updatePayload).eq('id', logId).eq('user_id', userId);
    updateError = firstAttempt.error;

    if (updateError && shouldRetryWithoutAdvancedColumns(updateError)) {
        updatePayload = { ...dbUpdates };
        const legacyAttempt = await supabase.from('daily_logs').update(updatePayload).eq('id', logId).eq('user_id', userId);
        updateError = legacyAttempt.error;
    }

    if (updateError) throw new Error(getErrorMessage(updateError));

    const changedEntries = Object.entries(dbUpdates).filter(([key, newValue]) => serializeAuditValue(existingLog[key]) !== serializeAuditValue(newValue));
    await Promise.all(
        changedEntries.map(([key, newValue]) => auditDailyLogChange(logId, modifiedBy, key, existingLog[key], newValue)),
    );

    await logUserAction(modifiedBy, 'daily_log_updated', `Se ha corregido el registro diario ${logId}.`);
};

type NutritionLogUpdates = {
    calories?: string;
    protein?: string;
    carbs?: string;
    fatsTotal?: string;
    portions?: string;
};

const getNutritionDescriptionPrefix = (description: string): string => {
    const nutriScorePrefix = description.match(/\[NS:[A-E]\]\s*/)?.[0] || '';
    const scorePrefix = description.match(/\[SC:[^\]]+\]\s*/)?.[0] || '';
    return `${nutriScorePrefix}${scorePrefix}`;
};

const mapNutritionUpdatesToDb = (updates: NutritionLogUpdates, existingDescription: string) => {
    const dbUpdates: Record<string, any> = {};
    if (updates.calories !== undefined) dbUpdates.calorias_est = parseNumberOrNull(updates.calories) ?? null;
    if (updates.protein !== undefined) dbUpdates.proteinas_g = parseNumberOrNull(updates.protein) ?? null;
    if (updates.carbs !== undefined) dbUpdates.carbohidratos_g = parseNumberOrNull(updates.carbs) ?? null;
    if (updates.fatsTotal !== undefined) dbUpdates.grasas_g = parseNumberOrNull(updates.fatsTotal) ?? null;
    if (updates.portions !== undefined) dbUpdates.comida_descripcion = `${getNutritionDescriptionPrefix(existingDescription)}${updates.portions}`;
    return dbUpdates;
};

export const saveNutritionLog = async (uid: string, analysis: NutritionalAnalysis): Promise<string> => {
    if (isDemo) return analysis.id;

    const nutriScorePrefix = analysis.analysis.nutriScore ? `[NS:${analysis.analysis.nutriScore}] ` : '';
    const score = analysis.analysis.nutritionScores;
    const scorePrefix = score
        ? `[SC:${score.protein},${score.fiber},${score.healthyFats},${score.micronutrients},${score.glycemicIndex},${score.sodiumBalance}] `
        : '';

    const { data, error } = await supabase.from('nutrition_logs').insert({
        user_id: uid,
        foto_url: analysis.imagePreview,
        comida_descripcion: `${nutriScorePrefix}${scorePrefix}${analysis.analysis.portions}`,
        calorias_est: parseNumberOrNull(analysis.analysis.calories) ?? null,
        proteinas_g: parseNumberOrNull(analysis.analysis.macros.protein) ?? null,
        carbohidratos_g: parseNumberOrNull(analysis.analysis.macros.carbs) ?? null,
        grasas_g: parseNumberOrNull(analysis.analysis.macros.fatsTotal) ?? null,
    }).select('id').single();
    if (error) throw new Error(getErrorMessage(error));

    await logUserAction(uid, 'nutrition_log_created', 'Se ha guardado un nuevo análisis nutricional.');
    return data?.id || analysis.id;
};

export const getNutritionLogs = async (uid: string): Promise<NutritionalAnalysis[]> => {
    if (isDemo) return [];
    const { data, error } = await supabase.from('nutrition_logs').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (error) throw new Error(getErrorMessage(error));

    return (data || []).map((item) => {
        let rawDescription = item.comida_descripcion || '';
        let nutriScore: NutriScore | undefined;
        let nutritionScores: NutritionScores = {
            protein: 50,
            fiber: 50,
            healthyFats: 50,
            micronutrients: 50,
            glycemicIndex: 50,
            sodiumBalance: 50,
        };

        const nutriScoreMatch = rawDescription.match(/\[NS:([A-E])\]/);
        if (nutriScoreMatch) {
            nutriScore = nutriScoreMatch[1] as NutriScore;
            rawDescription = rawDescription.replace(/\[NS:[A-E]\]\s*/, '');
        }

        const scoreMatch = rawDescription.match(/\[SC:(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\]/);
        if (scoreMatch) {
            nutritionScores = {
                protein: parseInt(scoreMatch[1], 10),
                fiber: parseInt(scoreMatch[2], 10),
                healthyFats: parseInt(scoreMatch[3], 10),
                micronutrients: parseInt(scoreMatch[4], 10),
                glycemicIndex: parseInt(scoreMatch[5], 10),
                sodiumBalance: parseInt(scoreMatch[6], 10),
            };
            rawDescription = rawDescription.replace(/\[SC:[^\]]+\]\s*/, '');
        }

        return {
            id: item.id,
            imagePreview: item.foto_url,
            createdAt: new Date(item.created_at),
            analysis: {
                calories: item.calorias_est?.toString() || '0',
                nutriScore,
                nutritionScores,
                macros: {
                    protein: item.proteinas_g?.toString() || '0',
                    carbs: item.carbohidratos_g?.toString() || '0',
                    fatsTotal: item.grasas_g?.toString() || '0',
                    fatsSaturated: '0',
                    fatsUnsaturated: '0',
                    fatsTrans: '0',
                    fiber: '0',
                },
                micros: {
                    calcium: '0',
                    vitaminD: '0',
                    vitaminB12: '0',
                    iron: '0',
                    sodium: '0',
                    potassium: '0',
                },
                portions: rawDescription,
                suggestions: [],
            },
        };
    });
};

export const updateNutritionLog = async (
    logId: string,
    userId: string,
    updates: NutritionLogUpdates,
): Promise<void> => {
    if (isDemo) return;

    const { data: existingLog, error: existingError } = await supabase
        .from('nutrition_logs')
        .select('*')
        .eq('id', logId)
        .eq('user_id', userId)
        .maybeSingle();

    if (existingError) throw new Error(getErrorMessage(existingError));
    if (!existingLog) throw new Error('No se encontró el registro nutricional a corregir.');

    const dbUpdates = mapNutritionUpdatesToDb(updates, existingLog.comida_descripcion || '');
    if (Object.keys(dbUpdates).length === 0) return;

    const { error } = await supabase
        .from('nutrition_logs')
        .update(dbUpdates)
        .eq('id', logId)
        .eq('user_id', userId);

    if (error) throw new Error(getErrorMessage(error));

    const changedEntries = Object.entries(dbUpdates).filter(([key, newValue]) => serializeAuditValue(existingLog[key]) !== serializeAuditValue(newValue));
    await Promise.all(
        changedEntries.map(([key, newValue]) => auditNutritionLogChange(logId, userId, key, existingLog[key], newValue)),
    );

    await logUserAction(userId, 'nutrition_log_updated', `Registro nutricional corregido: ${logId}.`);
};

export const deleteNutritionLog = async (logId: string, userId: string): Promise<void> => {
    if (isDemo) return;

    const { data: existingLog, error: existingError } = await supabase
        .from('nutrition_logs')
        .select('id')
        .eq('id', logId)
        .eq('user_id', userId)
        .maybeSingle();

    if (existingError) throw new Error(getErrorMessage(existingError));
    if (!existingLog) throw new Error('No se encontró el registro nutricional a eliminar.');

    const { error } = await supabase
        .from('nutrition_logs')
        .delete()
        .eq('id', logId)
        .eq('user_id', userId);

    if (error) throw new Error(getErrorMessage(error));
    await logUserAction(userId, 'nutrition_log_deleted', `Registro nutricional eliminado: ${logId}.`);
};

export const uploadFile = async (bucket: string, file: File): Promise<string> => {
    if (isDemo) return URL.createObjectURL(file);

    const cleanName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9.]/g, '_');

    const fileName = `${Date.now()}_${cleanName}`;
    const { error } = await supabase.storage.from(bucket).upload(fileName, file);
    if (error) throw new Error(getErrorMessage(error));
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
};

type ClinicalReportUpdates = {
    summary?: string;
    biomarkers?: Partial<Biomarkers>;
};

const CLINICAL_BIOMARKER_DB_FIELDS: Array<{ key: keyof Biomarkers; dbField: string }> = [
    { key: 'hemoglobin', dbField: 'hemoglobina' },
    { key: 'albumin', dbField: 'albumina' },
    { key: 'vitaminD', dbField: 'vitamina_d_25_oh' },
    { key: 'glucoseFasting', dbField: 'glucosa' },
    { key: 'creatinine', dbField: 'creatinina' },
    { key: 'crp', dbField: 'pcr' },
    { key: 'sodium', dbField: 'sodio' },
    { key: 'tsh', dbField: 'tsh' },
    { key: 'vitaminB12', dbField: 'vitamina_b12' },
];

const mapClinicalUpdatesToDb = (updates: ClinicalReportUpdates) => {
    const dbUpdates: Record<string, any> = {};
    if (updates.summary !== undefined) dbUpdates.resumen_ia = updates.summary;

    CLINICAL_BIOMARKER_DB_FIELDS.forEach(({ key, dbField }) => {
        const value = updates.biomarkers?.[key];
        if (value !== undefined) {
            dbUpdates[dbField] = parseNumberOrNull(value) ?? null;
        }
    });

    return dbUpdates;
};

export const saveClinicalReport = async (uid: string, analysis: ClinicalAnalysis): Promise<string> => {
    if (isDemo) return analysis.id;

    const { data, error } = await supabase.from('clinical_reports').insert({
        user_id: uid,
        file_name: analysis.fileName,
        resumen_ia: analysis.analysis.summary,
        hemoglobina: parseNumberOrNull(analysis.analysis.biomarkers.hemoglobin) ?? null,
        albumina: parseNumberOrNull(analysis.analysis.biomarkers.albumin) ?? null,
        vitamina_d_25_oh: parseNumberOrNull(analysis.analysis.biomarkers.vitaminD) ?? null,
        glucosa: parseNumberOrNull(analysis.analysis.biomarkers.glucoseFasting) ?? null,
        creatinina: parseNumberOrNull(analysis.analysis.biomarkers.creatinine) ?? null,
        pcr: parseNumberOrNull(analysis.analysis.biomarkers.crp) ?? null,
        sodio: parseNumberOrNull(analysis.analysis.biomarkers.sodium) ?? null,
        tsh: parseNumberOrNull(analysis.analysis.biomarkers.tsh) ?? null,
        vitamina_b12: parseNumberOrNull(analysis.analysis.biomarkers.vitaminB12) ?? null,
        created_at: analysis.createdAt,
    }).select('id').single();
    if (error) throw new Error(getErrorMessage(error));

    await logUserAction(uid, 'clinical_report_created', `Se ha guardado el informe ${analysis.fileName}.`);
    return data?.id || analysis.id;
};

export const getClinicalReports = async (uid: string): Promise<ClinicalAnalysis[]> => {
    if (isDemo) return [];
    const { data, error } = await supabase.from('clinical_reports').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (error) throw new Error(getErrorMessage(error));

    return (data || []).map((item) => ({
        id: item.id,
        fileName: item.file_name,
        createdAt: new Date(item.created_at),
        analysis: {
            summary: item.resumen_ia || '',
            recommendations: [],
            biomarkers: {
                hemoglobin: item.hemoglobina?.toString() || '---',
                albumin: item.albumina?.toString() || '---',
                vitaminD: item.vitamina_d_25_oh?.toString() || '---',
                glucoseFasting: item.glucosa?.toString() || '---',
                egfr: '---',
                sodium: item.sodio?.toString() || '---',
                crp: item.pcr?.toString() || '---',
                vitaminB12: item.vitamina_b12?.toString() || '---',
                tsh: item.tsh?.toString() || '---',
                creatinine: item.creatinina?.toString() || '---',
                ldl: '---',
                hba1c: '---',
            },
        },
    }));
};

export const updateClinicalReport = async (
    reportId: string,
    userId: string,
    updates: ClinicalReportUpdates,
): Promise<void> => {
    if (isDemo) return;

    const { data: existingReport, error: existingError } = await supabase
        .from('clinical_reports')
        .select('*')
        .eq('id', reportId)
        .eq('user_id', userId)
        .maybeSingle();

    if (existingError) throw new Error(getErrorMessage(existingError));
    if (!existingReport) throw new Error('No se encontró el informe clínico a corregir.');

    const dbUpdates = mapClinicalUpdatesToDb(updates);
    if (Object.keys(dbUpdates).length === 0) return;

    const { error } = await supabase
        .from('clinical_reports')
        .update(dbUpdates)
        .eq('id', reportId)
        .eq('user_id', userId);

    if (error) throw new Error(getErrorMessage(error));

    const changedEntries = Object.entries(dbUpdates).filter(([key, newValue]) => serializeAuditValue(existingReport[key]) !== serializeAuditValue(newValue));
    await Promise.all(
        changedEntries.map(([key, newValue]) => auditClinicalReportChange(reportId, userId, key, existingReport[key], newValue)),
    );

    await logUserAction(userId, 'clinical_report_updated', `Informe clínico corregido: ${reportId}.`);
};

export const deleteClinicalReport = async (reportId: string, userId: string): Promise<void> => {
    if (isDemo) return;

    const { data: existingReport, error: existingError } = await supabase
        .from('clinical_reports')
        .select('id, file_name')
        .eq('id', reportId)
        .eq('user_id', userId)
        .maybeSingle();

    if (existingError) throw new Error(getErrorMessage(existingError));
    if (!existingReport) throw new Error('No se encontró el informe clínico a eliminar.');

    const { error } = await supabase
        .from('clinical_reports')
        .delete()
        .eq('id', reportId)
        .eq('user_id', userId);

    if (error) throw new Error(getErrorMessage(error));
    await logUserAction(userId, 'clinical_report_deleted', `Informe clínico eliminado: ${existingReport.file_name || reportId}.`);
};

export const getAdminUsers = async (): Promise<AdminUserSummary[]> => {
    if (isDemo) return [];
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(getErrorMessage(error));

    return (data || []).map((user) => ({
        id: user.id,
        displayName: user.nombre_usuario || 'Usuario',
        email: user.email || '',
        role: (user.role as UserRole) || 'patient',
        active: user.active ?? true,
        createdAt: user.created_at ? new Date(user.created_at) : undefined,
        updatedAt: user.updated_at ? new Date(user.updated_at) : undefined,
        createdBy: user.created_by ?? null,
        updatedBy: user.updated_by ?? null,
    }));
};

export const updateAdminUser = async (
    targetUserId: string,
    actorUserId: string,
    updates: { role?: UserRole; active?: boolean },
): Promise<void> => {
    if (isDemo) return;

    const { data: existingUser, error: existingError } = await supabase.from('users').select('*').eq('id', targetUserId).maybeSingle();
    if (existingError) throw new Error(getErrorMessage(existingError));
    if (!existingUser) throw new Error('No se ha encontrado el usuario.');

    const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
        updated_by: actorUserId,
    };
    if (updates.role !== undefined) payload.role = updates.role;
    if (updates.active !== undefined) payload.active = updates.active;

    const { error } = await supabase.from('users').update(payload).eq('id', targetUserId);
    if (error) throw new Error(getErrorMessage(error));

    const changedFields = Object.entries(updates).filter(([key, value]) => serializeAuditValue(existingUser[key]) !== serializeAuditValue(value));
    await Promise.all(
        changedFields.map(([key, value]) => auditUserChange(targetUserId, actorUserId, key, existingUser[key], value)),
    );

    await logUserAction(actorUserId, 'admin_user_updated', `Actualización administrativa del usuario ${targetUserId}.`);
};

export const getUserActionLogs = async (limit: number = 50): Promise<UserActionLog[]> => {
    if (isDemo) return [];
    const { data, error } = await supabase.from('user_action_log').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw new Error(getErrorMessage(error));

    return (data || []).map((log) => ({
        id: log.id,
        userId: log.user_id,
        actionType: log.action_type,
        description: log.description,
        createdAt: new Date(log.created_at),
    }));
};

export const isInDemoMode = isDemo;
