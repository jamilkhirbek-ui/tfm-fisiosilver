import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getDailyHistory, saveDailyLog, updateDailyLog } from '../services/dbService';
import { CheckCircleIcon, PencilSquareIcon } from '../components/Icons';
import type { DailyLogRecord, HealthData } from '../types';

type DailyDataForm = { [K in keyof HealthData]: string };

const initialFormData: DailyDataForm = {
    weight: '',
    falls: '',
    systolicBP: '',
    diastolicBP: '',
    pulse: '',
    oxygenSaturation: '',
    glucose: '',
    calfCircumference: '',
    abdominalCircumference: '',
    height: '',
};

const formFields: { label: string; id: keyof HealthData; unit: string }[] = [
    { label: 'Peso Corporal', id: 'weight', unit: 'kg' },
    { label: 'Tension Sistolica', id: 'systolicBP', unit: 'mmHg' },
    { label: 'Tension Diastolica', id: 'diastolicBP', unit: 'mmHg' },
    { label: 'Pulso Cardiaco', id: 'pulse', unit: 'lpm' },
    { label: 'Oxigeno', id: 'oxygenSaturation', unit: '%' },
    { label: 'Azucar', id: 'glucose', unit: 'mg/dl' },
    { label: 'Pantorrilla', id: 'calfCircumference', unit: 'cm' },
    { label: 'Abdomen', id: 'abdominalCircumference', unit: 'cm' },
    { label: 'Caidas', id: 'falls', unit: 'n' },
];

const buildPartialHealthData = (formData: DailyDataForm): Partial<HealthData> => {
    const updated: Partial<HealthData> = {};
    Object.keys(formData).forEach((key) => {
        const rawValue = formData[key as keyof HealthData].replace(',', '.').trim();
        if (!rawValue) return;
        updated[key as keyof HealthData] = parseFloat(rawValue);
    });
    return updated;
};

const toFormData = (record: DailyLogRecord): DailyDataForm => ({
    weight: record.weight?.toString() || '',
    falls: record.falls?.toString() || '',
    systolicBP: record.systolicBP?.toString() || '',
    diastolicBP: record.diastolicBP?.toString() || '',
    pulse: record.pulse?.toString() || '',
    oxygenSaturation: record.oxygenSaturation?.toString() || '',
    glucose: record.glucose?.toString() || '',
    calfCircumference: record.calfCircumference?.toString() || '',
    abdominalCircumference: record.abdominalCircumference?.toString() || '',
    height: '',
});

const DiaryScreen: React.FC = () => {
    const context = useContext(AppContext);
    const { user } = useAuth();
    const { healthData, setHealthData, diaryPreferences } = context!;

    const [formData, setFormData] = useState<DailyDataForm>(initialFormData);
    const [history, setHistory] = useState<DailyLogRecord[]>([]);
    const [editingLogId, setEditingLogId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const visibleFields = formFields.filter((field) => (diaryPreferences || []).includes(field.id));

    const refreshHistory = async () => {
        if (!user) return;
        setIsLoadingHistory(true);
        try {
            const loadedHistory = await getDailyHistory(user.uid);
            setHistory(loadedHistory);
            if (loadedHistory[0]) {
                const latest = loadedHistory[0];
                setHealthData((previous) => ({
                    weight: latest.weight,
                    falls: latest.falls,
                    systolicBP: latest.systolicBP,
                    diastolicBP: latest.diastolicBP,
                    pulse: latest.pulse,
                    oxygenSaturation: latest.oxygenSaturation,
                    glucose: latest.glucose,
                    calfCircumference: latest.calfCircumference,
                    abdominalCircumference: latest.abdominalCircumference,
                    height: previous.height ?? null,
                }));
            }
        } finally {
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => {
        refreshHistory();
    }, [user]);

    const resetEditor = () => {
        setEditingLogId(null);
        setFormData(initialFormData);
    };

    const handleSave = async () => {
        if (!user) return;

        const updatedFields = buildPartialHealthData(formData);
        if (Object.keys(updatedFields).length === 0) return;

        setIsSaving(true);
        const wasEditing = Boolean(editingLogId);
        try {
            if (editingLogId) {
                await updateDailyLog(editingLogId, user.uid, updatedFields);
            } else {
                const currentHealthData = { ...healthData, ...updatedFields };
                await saveDailyLog(user.uid, currentHealthData);
            }

            await refreshHistory();
            resetEditor();
            setSuccessMessage(wasEditing ? 'Correccion guardada con exito' : 'Registro guardado con exito');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error) {
            console.error(error);
            alert('Error al guardar el registro diario.');
        } finally {
            setIsSaving(false);
        }
    };

    const startEditing = (record: DailyLogRecord) => {
        setEditingLogId(record.id);
        setFormData(toFormData(record));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="p-6 max-w-5xl mx-auto animate-fade-in pb-32">
            <header className="mb-16 pt-10 text-center sm:text-left overflow-visible">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-3">
                    <div className="w-8 h-1 rounded-full bg-brand-blue shrink-0" />
                    <p className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-[0.25em]">Registro Diario</p>
                </div>
                <h1 className="text-4xl sm:text-5xl font-black text-brand-gray-900 tracking-tighter uppercase mb-2 leading-tight break-words pr-4">
                    Mi Diario
                    <br />
                    <span className="bg-brand-gradient bg-clip-text text-transparent italic px-1 -mx-1">DE SALUD</span>
                </h1>
                <p className="text-sm text-brand-gray-500 font-medium mt-4">
                    Puedes registrar constantes nuevas y corregir un registro anterior si detectas un error.
                </p>
            </header>

            <div className="bg-white p-1 rounded-[2.5rem] shadow-premium-lg border border-brand-gray-100 relative overflow-hidden animate-slide-up group">
                <div className="p-8 sm:p-12">
                    {editingLogId && (
                        <div className="mb-8 p-5 bg-brand-lightblue/40 rounded-2xl border border-brand-blue/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <p className="text-brand-blue font-black uppercase text-[10px] tracking-widest">Modo correccion</p>
                                <p className="text-brand-gray-700 font-medium text-sm">Estas editando un registro ya guardado del historial.</p>
                            </div>
                            <button
                                onClick={resetEditor}
                                className="px-4 py-3 rounded-2xl border border-brand-gray-100 bg-white text-brand-gray-700 font-black text-[10px] uppercase tracking-widest"
                            >
                                Cancelar correccion
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-16">
                        {visibleFields.map((field, index) => (
                            <div
                                key={field.id}
                                className="relative animate-slide-up flex flex-col items-center sm:items-start group/field"
                                style={{ animationDelay: `${index * 0.05}s` }}
                            >
                                <label className="block text-[11px] font-black text-brand-gray-400 uppercase tracking-[0.2em] mb-4 ml-1 group-focus-within/field:text-brand-blue transition-colors">
                                    {field.label}
                                </label>
                                <div className="flex items-center gap-5 w-full max-w-[320px] relative">
                                    <div className="absolute inset-0 bg-brand-blue/5 rounded-[2rem] scale-95 opacity-0 group-focus-within/field:scale-110 group-focus-within/field:opacity-100 transition-all duration-500" />
                                    <input
                                        type="number"
                                        value={formData[field.id]}
                                        onChange={(event) => setFormData({ ...formData, [field.id]: event.target.value })}
                                        className="relative z-10 w-full p-8 bg-white border-2 border-brand-gray-100 rounded-[2rem] text-4xl sm:text-5xl font-black text-brand-gray-900 outline-none focus:border-brand-blue focus:shadow-premium transition-all text-center tracking-tight placeholder:text-brand-gray-100"
                                        placeholder={healthData[field.id]?.toString() || '0'}
                                    />
                                    <div className="flex flex-col shrink-0 relative z-10 w-12">
                                        <span className="text-xs font-black text-brand-blue uppercase tracking-tighter leading-none">{field.unit}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {visibleFields.length === 0 && (
                        <div className="text-center py-24 bg-brand-gray-50/50 rounded-[2rem] border border-dashed border-brand-gray-200">
                            <div className="w-20 h-20 bg-brand-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircleIcon className="w-10 h-10 text-brand-gray-300" />
                            </div>
                            <p className="text-brand-gray-500 font-black uppercase tracking-widest text-sm mb-3">No hay metricas activas</p>
                            <p className="text-[10px] text-brand-gray-400 font-bold uppercase tracking-[0.2em]">Configuralas en tu perfil para empezar el seguimiento</p>
                        </div>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={isSaving || visibleFields.length === 0}
                        className="w-full mt-24 bg-brand-gradient text-white py-8 rounded-[2rem] font-black text-xl uppercase tracking-[0.3em] shadow-premium hover:shadow-premium-lg hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 relative overflow-hidden group/btn"
                    >
                        <span className="relative z-10">
                            {isSaving ? 'Guardando...' : editingLogId ? 'Guardar Correccion' : 'Confirmar Registro'}
                        </span>
                        <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000" />
                    </button>

                    {successMessage && (
                        <div className="mt-12 p-8 bg-brand-soft-green text-brand-green rounded-[2rem] flex items-center justify-center gap-6 animate-fade-in shadow-soft border border-brand-green/10">
                            <div className="w-10 h-10 bg-brand-green text-white rounded-full flex items-center justify-center">
                                <CheckCircleIcon className="w-6 h-6" />
                            </div>
                            <span className="font-black text-xs uppercase tracking-[0.3em]">{successMessage}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-16">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-[11px] font-black text-brand-gray-400 uppercase tracking-[0.4em]">Historial Reciente</h2>
                    <span className="text-[10px] font-bold text-brand-blue bg-brand-lightblue px-3 py-1 rounded-full">{history.length} registros</span>
                </div>

                {isLoadingHistory ? (
                    <div className="bg-white rounded-3xl p-8 border border-brand-gray-100 shadow-soft text-brand-gray-500 font-medium">
                        Cargando historial...
                    </div>
                ) : history.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 border border-brand-gray-100 shadow-soft text-brand-gray-500 font-medium">
                        Todavia no hay registros diarios guardados.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {history.slice(0, 10).map((record) => (
                            <div key={record.id} className="bg-white rounded-3xl p-6 border border-brand-gray-100 shadow-soft">
                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                    <div>
                                        <p className="text-lg font-black text-brand-gray-900">
                                            {record.createdAt.toLocaleDateString('es-ES')} {record.createdAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        <div className="flex flex-wrap gap-3 mt-3">
                                            {visibleFields.map((field) => {
                                                const value = record[field.id];
                                                if (value === null || value === undefined) return null;
                                                return (
                                                    <span key={field.id} className="px-3 py-2 rounded-2xl bg-brand-gray-50 text-brand-gray-700 text-xs font-bold">
                                                        {field.label}: {value} {field.unit}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => startEditing(record)}
                                        className="px-5 py-4 rounded-2xl bg-brand-lightblue text-brand-blue font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                                    >
                                        <PencilSquareIcon className="w-4 h-4" />
                                        Corregir
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DiaryScreen;
