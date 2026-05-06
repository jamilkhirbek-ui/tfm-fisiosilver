
import React, { useState, useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { AI_NOT_CONFIGURED_MESSAGE, analyzeClinicalReport, analyzeClinicalText } from '../services/geminiService';
import { deleteClinicalReport, saveClinicalReport, updateClinicalReport, uploadFile } from '../services/dbService';
import { UploadIcon, CheckCircleIcon, LightBulbIcon, PencilSquareIcon, DocumentTextIcon } from '../components/Icons';
import AnalysisDisplay from '../components/AnalysisDisplay';
import type { Biomarkers, ClinicalAnalysis, ClinicalAnalysisResult } from '../types';

type ClinicalEditForm = {
    summary: string;
    biomarkers: Partial<Biomarkers>;
};

const CLINICAL_EDITABLE_BIOMARKERS: Array<{ key: keyof Biomarkers; label: string }> = [
    { key: 'hemoglobin', label: 'Hemoglobina' },
    { key: 'albumin', label: 'Albúmina' },
    { key: 'vitaminD', label: 'Vitamina D' },
    { key: 'glucoseFasting', label: 'Glucosa' },
    { key: 'creatinine', label: 'Creatinina' },
    { key: 'crp', label: 'PCR' },
    { key: 'sodium', label: 'Sodio' },
    { key: 'tsh', label: 'TSH' },
    { key: 'vitaminB12', label: 'Vitamina B12' },
];

const ClinicalScreen: React.FC<{ isAiEnabled: boolean; onConfigureAi: () => Promise<void> | void }> = ({ isAiEnabled, onConfigureAi }) => {
    const context = useContext(AppContext);
    const { user } = useAuth();
    const { clinicalAnalyses, setClinicalAnalyses } = context!;
    const [isManualEntry, setIsManualEntry] = useState(false);
    const [manualText, setManualText] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [editingReportId, setEditingReportId] = useState<string | null>(null);
    const [clinicalEditForm, setClinicalEditForm] = useState<ClinicalEditForm | null>(null);
    const [isUpdatingReport, setIsUpdatingReport] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setSelectedFile(event.target.files[0]);
            setError(null);
            setSuccessMessage(null);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !user) return;
        if (!isAiEnabled) {
            setError(AI_NOT_CONFIGURED_MESSAGE);
            return;
        }
        setIsLoading(true);
        setError(null);
        
        try {
            setLoadingMessage("IA Analizando Analítica...");
            const analysisResult = await analyzeClinicalReport(selectedFile);
            
            setLoadingMessage("Guardando en el Historial...");
            // uploadFile ya sanitiza el nombre internamente
            await uploadFile('clinical-reports', selectedFile);
            
            const newAnalysis = {
                id: Date.now().toString(),
                fileName: selectedFile.name,
                analysis: analysisResult,
                createdAt: new Date(),
            };

            const savedId = await saveClinicalReport(user.uid, newAnalysis);
            setClinicalAnalyses(prev => [{ ...newAnalysis, id: savedId }, ...prev]);
            
            setSelectedFile(null);
            setSuccessMessage('Informe clínico procesado correctamente.');
            setTimeout(() => setSuccessMessage(null), 4000);

        } catch (err: any) {
            console.error(err);
            if (err.message === "API_KEY_RESET") {
                setError("La clave de API ha expirado o es inválida. Por favor, reinicie la aplicación o vuelva a configurar la clave.");
                if (window.aistudio) window.aistudio.openSelectKey();
            } else {
                setError(err.message || "Error al procesar el archivo.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleManualAnalysis = async () => {
        if (!manualText.trim() || !user) return;
        if (!isAiEnabled) {
            setError(AI_NOT_CONFIGURED_MESSAGE);
            return;
        }
        setIsLoading(true);
        setError(null);
        
        try {
            setLoadingMessage("IA Analizando Texto...");
            const analysisResult = await analyzeClinicalText(manualText);
            
            const newAnalysis = {
                id: Date.now().toString(),
                fileName: "Entrada Manual / Texto",
                analysis: analysisResult,
                createdAt: new Date(),
            };

            const savedId = await saveClinicalReport(user.uid, newAnalysis);
            setClinicalAnalyses(prev => [{ ...newAnalysis, id: savedId }, ...prev]);
            
            setManualText("");
            setIsManualEntry(false);
            setSuccessMessage('Análisis de texto completado correctamente.');
            setTimeout(() => setSuccessMessage(null), 4000);

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Error al procesar el texto.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartClinicalEdit = (item: ClinicalAnalysis) => {
        const editableBiomarkers = CLINICAL_EDITABLE_BIOMARKERS.reduce<Partial<Biomarkers>>((values, field) => {
            values[field.key] = item.analysis.biomarkers[field.key] || '';
            return values;
        }, {});

        setEditingReportId(item.id);
        setClinicalEditForm({
            summary: item.analysis.summary || '',
            biomarkers: editableBiomarkers,
        });
        setError(null);
        setSuccessMessage(null);
    };

    const handleClinicalBiomarkerChange = (key: keyof Biomarkers, value: string) => {
        setClinicalEditForm(prev => prev ? {
            ...prev,
            biomarkers: {
                ...prev.biomarkers,
                [key]: value,
            },
        } : prev);
    };

    const handleSaveClinicalEdit = async (item: ClinicalAnalysis) => {
        if (!user || !clinicalEditForm) return;
        setIsUpdatingReport(true);
        setError(null);
        setSuccessMessage(null);

        try {
            await updateClinicalReport(item.id, user.uid, clinicalEditForm);
            setClinicalAnalyses(prev => prev.map(report => report.id === item.id ? {
                ...report,
                analysis: {
                    ...report.analysis,
                    summary: clinicalEditForm.summary,
                    biomarkers: {
                        ...report.analysis.biomarkers,
                        ...clinicalEditForm.biomarkers,
                    },
                },
            } : report));
            setEditingReportId(null);
            setClinicalEditForm(null);
            setSuccessMessage('Informe clínico corregido correctamente.');
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'No se pudo corregir el informe.');
        } finally {
            setIsUpdatingReport(false);
        }
    };

    const handleDeleteClinicalReport = async (item: ClinicalAnalysis) => {
        if (!user) return;
        const shouldDelete = window.confirm('¿Eliminar este informe clínico? Esta acción no borra otros datos del paciente.');
        if (!shouldDelete) return;

        setIsUpdatingReport(true);
        setError(null);
        setSuccessMessage(null);

        try {
            await deleteClinicalReport(item.id, user.uid);
            setClinicalAnalyses(prev => prev.filter(report => report.id !== item.id));
            if (editingReportId === item.id) {
                setEditingReportId(null);
                setClinicalEditForm(null);
            }
            setSuccessMessage('Informe clínico eliminado correctamente.');
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'No se pudo eliminar el informe.');
        } finally {
            setIsUpdatingReport(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto pb-32 animate-fade-in">
            <header className="mb-16 pt-10 text-center sm:text-left animate-slide-up overflow-visible">
                 <div className="flex items-center justify-center sm:justify-start gap-2 mb-3">
                    <div className="w-8 h-1 rounded-full bg-brand-blue shrink-0" />
                    <p className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-[0.22em]">Laboratorio Digital</p>
                </div>
                <h1 className="text-5xl font-black text-brand-gray-900 tracking-tighter uppercase leading-none pr-4">Informes<br/><span className="bg-brand-gradient bg-clip-text text-transparent px-1 -mx-1">CLÍNICOS</span></h1>
            </header>

            <div className="bg-white p-1 rounded-[2.5xl] shadow-premium-lg border border-brand-gray-100 relative overflow-hidden animate-slide-up group" style={{ animationDelay: '0.1s' }}>
                <div className="p-8 sm:p-10">
                    {!isAiEnabled && (
                        <div className="mb-8 p-6 bg-brand-gray-50 border border-brand-gray-100 rounded-2xl">
                            <p className="text-brand-gray-700 font-bold text-sm leading-relaxed">{AI_NOT_CONFIGURED_MESSAGE}</p>
                            <button
                                onClick={() => onConfigureAi()}
                                className="mt-4 px-5 py-3 rounded-2xl bg-brand-blue text-white font-black text-[10px] uppercase tracking-widest"
                            >
                                Configurar IA
                            </button>
                        </div>
                    )}

                    <div className="flex bg-brand-gray-50 p-1.5 rounded-2xl gap-2 mb-10">
                        <button 
                            onClick={() => setIsManualEntry(false)}
                            className={`flex-1 py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all duration-300 ${!isManualEntry ? 'bg-white text-brand-blue shadow-premium border border-brand-gray-100' : 'text-brand-gray-400 hover:text-brand-gray-600'}`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <DocumentTextIcon className="w-4 h-4" />
                                Subir Documento
                            </div>
                        </button>
                        <button 
                            onClick={() => setIsManualEntry(true)}
                            className={`flex-1 py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all duration-300 ${isManualEntry ? 'bg-white text-brand-blue shadow-premium border border-brand-gray-100' : 'text-brand-gray-400 hover:text-brand-gray-600'}`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <PencilSquareIcon className="w-4 h-4" />
                                Pegar Texto
                            </div>
                        </button>
                    </div>

                    {!isManualEntry ? (
                        <>
                            <div className="max-w-md mx-auto text-center mb-10">
                                <h2 className="text-2xl font-black text-brand-gray-900 mb-3 tracking-tight">Análisis mediante Visión IA</h2>
                                <p className="text-brand-gray-500 font-medium text-sm leading-relaxed">Nuestra inteligencia lee sus informes con precisión médica, detectando tendencias y valores de salud clave.</p>
                            </div>
                            
                            <div className={`group/dropzone flex flex-col items-center border-2 border-dashed rounded-[2rem] p-12 text-center transition-all duration-500 cursor-pointer relative overflow-hidden ${selectedFile ? 'border-brand-blue bg-brand-lightblue/30 shadow-inner' : 'border-brand-gray-200 bg-brand-gray-50/50 hover:border-brand-blue/40 hover:bg-white hover:shadow-premium'}`}>
                                <input type="file" id="file-upload" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
                                {!selectedFile ? (
                                    <label htmlFor="file-upload" className="cursor-pointer group/label w-full block">
                                        <div className="bg-brand-blue text-white w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-premium-lg group-hover/dropzone:scale-110 group-hover/dropzone:rotate-3 transition-all duration-500">
                                            <UploadIcon className="w-8 h-8" />
                                        </div>
                                        <span className="text-lg font-black text-brand-gray-900 tracking-tight block">Seleccione su Analítica</span>
                                        <p className="text-[10px] font-bold text-brand-gray-400 mt-2 uppercase tracking-widest">Puede ser una foto clara o un archivo PDF</p>
                                    </label>
                                ) : (
                                    <div className="w-full relative z-10 animate-fade-in">
                                        <div className="bg-brand-green text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg animate-pulse-soft">
                                            <CheckCircleIcon className="w-8 h-8" />
                                        </div>
                                        <p className="text-lg font-black text-brand-gray-900 truncate px-4 max-w-xs mx-auto">{selectedFile.name}</p>
                                        <button onClick={() => setSelectedFile(null)} className="mt-4 text-[10px] font-black text-brand-red uppercase tracking-widest hover:underline underline-offset-4">Cambiar archivo</button>
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={handleUpload} 
                                disabled={!selectedFile || isLoading || !isAiEnabled} 
                                className="w-full mt-10 bg-brand-gradient text-white text-base font-black py-6 rounded-2xl shadow-premium hover:shadow-premium-lg hover:scale-[1.01] transition-all active:scale-[0.98] disabled:opacity-50 disabled:scale-100 uppercase tracking-[0.2em] relative overflow-hidden group"
                            >
                                <span className="relative z-10">{isLoading ? 'Procesando Informe...' : 'Extraer Datos Técnicos'}</span>
                                {isLoading && <div className="absolute inset-0 bg-white/20 animate-pulse" />}
                            </button>
                        </>
                    ) : (
                        <div className="animate-fade-in">
                            <h2 className="text-2xl font-black text-brand-gray-900 mb-6 tracking-tight">Análisis de Texto</h2>
                            <textarea 
                                value={manualText}
                                onChange={(e) => setManualText(e.target.value)}
                                placeholder="Pegue aquí el bloque de texto de su portal del paciente o laboratorio..."
                                className="w-full h-80 p-8 bg-brand-gray-50 border border-brand-gray-100 rounded-[2rem] text-brand-gray-900 font-medium focus:border-brand-blue focus:bg-white focus:shadow-premium outline-none transition-all resize-none text-sm leading-relaxed"
                            />

                            <button 
                                onClick={handleManualAnalysis} 
                                disabled={!manualText.trim() || isLoading || !isAiEnabled} 
                                className="w-full mt-10 bg-brand-gradient text-white text-base font-black py-6 rounded-2xl shadow-premium hover:shadow-premium-lg transition-all active:scale-[0.98] disabled:opacity-50 uppercase tracking-[0.2em]"
                            >
                                {isLoading ? 'Interpretando Texto...' : 'Iniciar Análisis IA'}
                            </button>
                        </div>
                    )}

                    {error && <div className="mt-8 p-6 bg-brand-soft-red text-brand-red rounded-2xl border border-brand-red/10 font-bold text-center text-xs tracking-tight animate-fade-in">{error}</div>}
                    {successMessage && <div className="mt-8 p-6 bg-brand-soft-green text-brand-green rounded-2xl border border-brand-green/10 font-bold text-center text-xs flex items-center justify-center gap-3 animate-fade-in shadow-soft"><CheckCircleIcon className="w-5 h-5" /> {successMessage}</div>}
                </div>
            </div>

            {isLoading && (
                <div className="mt-12 text-center animate-fade-in">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="w-2 h-2 bg-brand-blue rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-2 h-2 bg-brand-blue rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-2 h-2 bg-brand-blue rounded-full animate-bounce" />
                    </div>
                    <p className="text-sm font-bold text-brand-gray-500 italic">"Su privacidad es nuestra prioridad. Los datos se procesan de forma segura."</p>
                </div>
            )}

            <div className="mt-24 space-y-12">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-[11px] font-black text-brand-gray-400 uppercase tracking-[0.4em]">Historial Reciente</h2>
                    <span className="text-[10px] font-bold text-brand-blue bg-brand-lightblue px-3 py-1 rounded-full">{clinicalAnalyses.length} Informes</span>
                </div>
                
                {clinicalAnalyses.length === 0 ? (
                    <div className="bg-white p-24 rounded-[2.5rem] text-center shadow-soft border border-brand-gray-50 border-dashed">
                        <div className="bg-brand-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <DocumentTextIcon className="w-10 h-10 text-brand-gray-200" />
                        </div>
                        <p className="text-brand-gray-300 font-bold uppercase tracking-widest text-[11px]">No se han encontrado registros previos</p>
                    </div>
                ) : (
                    <div className="space-y-10">
                        {clinicalAnalyses.map(item => (
                            <div key={item.id} className="animate-slide-up">
                                <div className="group bg-white p-1 rounded-[2.5rem] shadow-soft border border-brand-gray-100 hover:shadow-premium-lg transition-all duration-500 overflow-hidden">
                                    <div className="p-8 sm:p-10">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 border-b border-brand-gray-50 pb-8">
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 bg-brand-gradient rounded-2xl flex items-center justify-center text-white shadow-premium">
                                                    <DocumentTextIcon className="w-7 h-7" />
                                                </div>
                                                <div>
                                                    <h3 className="text-2xl font-black text-brand-gray-900 tracking-tighter uppercase leading-none group-hover:text-brand-blue transition-colors">{item.fileName}</h3>
                                                    <p className="text-[10px] font-bold text-brand-gray-400 mt-2 uppercase tracking-widest">{item.createdAt.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border border-emerald-100 shadow-sm">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    Interpretado por IA
                                                </div>
                                                <button
                                                    onClick={() => handleStartClinicalEdit(item)}
                                                    disabled={isUpdatingReport}
                                                    className="px-4 py-2 rounded-xl bg-brand-lightblue text-brand-blue text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
                                                >
                                                    Corregir datos técnicos
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClinicalReport(item)}
                                                    disabled={isUpdatingReport}
                                                    className="px-4 py-2 rounded-xl bg-brand-soft-red text-brand-red text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
                                                >
                                                    Eliminar informe
                                                </button>
                                            </div>
                                        </div>
                                        {editingReportId === item.id && clinicalEditForm && (
                                            <div className="mb-10 p-6 rounded-2xl bg-brand-gray-50 border border-brand-gray-100 animate-fade-in">
                                                <h4 className="text-[11px] font-black text-brand-gray-400 uppercase tracking-[0.25em] mb-4">Corrección técnica</h4>
                                                <label className="block text-xs font-black text-brand-gray-500 uppercase tracking-widest mb-2">Resumen</label>
                                                <textarea
                                                    value={clinicalEditForm.summary}
                                                    onChange={(event) => setClinicalEditForm(prev => prev ? { ...prev, summary: event.target.value } : prev)}
                                                    className="w-full min-h-28 p-4 rounded-xl bg-white border border-brand-gray-100 text-sm font-medium text-brand-gray-800 outline-none focus:border-brand-blue"
                                                />
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                                                    {CLINICAL_EDITABLE_BIOMARKERS.map(field => (
                                                        <label key={field.key} className="block">
                                                            <span className="block text-[10px] font-black text-brand-gray-400 uppercase tracking-widest mb-1">{field.label}</span>
                                                            <input
                                                                value={clinicalEditForm.biomarkers[field.key] || ''}
                                                                onChange={(event) => handleClinicalBiomarkerChange(field.key, event.target.value)}
                                                                className="w-full p-3 rounded-xl bg-white border border-brand-gray-100 text-sm font-bold text-brand-gray-800 outline-none focus:border-brand-blue"
                                                            />
                                                        </label>
                                                    ))}
                                                </div>
                                                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                                                    <button
                                                        onClick={() => handleSaveClinicalEdit(item)}
                                                        disabled={isUpdatingReport}
                                                        className="flex-1 py-3 rounded-xl bg-brand-blue text-white font-black text-[10px] uppercase tracking-widest disabled:opacity-50"
                                                    >
                                                        Guardar corrección
                                                    </button>
                                                    <button
                                                        onClick={() => { setEditingReportId(null); setClinicalEditForm(null); }}
                                                        disabled={isUpdatingReport}
                                                        className="flex-1 py-3 rounded-xl bg-white text-brand-gray-500 font-black text-[10px] uppercase tracking-widest border border-brand-gray-100 disabled:opacity-50"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        <AnalysisDisplay analysis={item.analysis} type="clinical" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClinicalScreen;
