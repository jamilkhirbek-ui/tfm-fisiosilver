
import React, { useState, useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { AI_NOT_CONFIGURED_MESSAGE, analyzeFoodPhoto } from '../services/geminiService';
import { saveNutritionLog, uploadFile } from '../services/dbService';
import { UploadIcon, CheckCircleIcon } from '../components/Icons';
import AnalysisDisplay from '../components/AnalysisDisplay';
import type { NutritionalAnalysisResult } from '../types';

const LoadingSpinner = ({ message }: { message: string }) => (
    <div className="flex flex-col justify-center items-center p-12 text-center bg-brand-gray-50 rounded-3xl shadow-inner">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-brand-blue mb-6"></div>
        <p className="text-2xl font-black text-brand-gray-900 uppercase tracking-tighter">{message}</p>
        <p className="text-[10px] font-bold text-brand-gray-400 mt-2 uppercase tracking-widest">Identificando nutrientes para vitalidad senior...</p>
    </div>
);

const NutritionScreen: React.FC<{ isAiEnabled: boolean; onConfigureAi: () => Promise<void> | void }> = ({ isAiEnabled, onConfigureAi }) => {
    const context = useContext(AppContext);
    const { user } = useAuth();
    const { nutritionalAnalyses, setNutritionalAnalyses } = context!;
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);


    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            setSelectedFile(file);
            setImagePreview(URL.createObjectURL(file));
            setError(null);
            setSuccessMessage(null);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !user) {
            setError("Por favor, seleccione una foto.");
            return;
        }
        if (!isAiEnabled) {
            setError(AI_NOT_CONFIGURED_MESSAGE);
            return;
        }
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        
        try {
            setLoadingMessage("IA Analizando plato...");
            const analysisResult: NutritionalAnalysisResult = await analyzeFoodPhoto(selectedFile);
            
            setLoadingMessage("Guardando evidencia...");
            const remoteUrl = await uploadFile('nutrition-photos', selectedFile);
            
            const newAnalysis = {
                id: Date.now().toString(),
                imagePreview: remoteUrl, 
                analysis: analysisResult,
                createdAt: new Date(),
            };

            await saveNutritionLog(user.uid, newAnalysis);
            setNutritionalAnalyses(prev => [newAnalysis, ...prev]);

            setSelectedFile(null);
            setImagePreview(null);
            const fileInput = document.getElementById('food-upload') as HTMLInputElement;
            if(fileInput) fileInput.value = "";
            
            setSuccessMessage('Análisis nutricional guardado con éxito.');
            setTimeout(() => setSuccessMessage(null), 3000);

        } catch (err: any) {
            console.error("[NUTRITION ERROR]", err);
            if (err.message === "API_KEY_RESET") {
                setError("La clave de API ha expirado o es inválida. Por favor, vuelva a configurar la clave.");
                if (window.aistudio) window.aistudio.openSelectKey();
            } else {
                setError(err.message || "Error al procesar la imagen. Inténtelo de nuevo.");
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto pb-32">
            <header className="mb-12 pt-6 text-center sm:text-left overflow-visible">
                <h1 className="text-5xl font-black text-brand-gray-900 tracking-tighter uppercase leading-none pr-4">Nutrición<br/><span className="bg-brand-gradient bg-clip-text text-transparent px-1 -mx-1">IA SENIOR</span></h1>
                <p className="text-[10px] font-black text-brand-gray-400 uppercase tracking-[0.2em] mt-4">Alimentación consciente para la longevidad</p>
            </header>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-brand-gray-50 mb-12 hover:shadow-soft-lg transition-all duration-500 group animate-fade-in relative overflow-hidden">
                <div className="absolute -top-4 -right-4 bg-brand-lightblue/20 w-32 h-32 rounded-full group-hover:scale-150 transition-transform duration-700"></div>

                {!isAiEnabled && (
                    <div className="mb-8 p-6 bg-brand-gray-50 border border-brand-gray-100 rounded-2xl relative z-10">
                        <p className="text-brand-gray-700 font-bold text-sm leading-relaxed">{AI_NOT_CONFIGURED_MESSAGE}</p>
                        <button
                            onClick={() => onConfigureAi()}
                            className="mt-4 px-5 py-3 rounded-2xl bg-brand-blue text-white font-black text-[10px] uppercase tracking-widest"
                        >
                            Configurar IA
                        </button>
                    </div>
                )}
                
                <h2 className="text-2xl font-black text-brand-gray-900 mb-6 uppercase tracking-tighter">Analizar mi Comida</h2>
                <p className="text-brand-gray-600 mb-10 font-bold text-sm leading-relaxed max-w-md">Tome una fotografía de su plato y déjenos calcular los macronutrientes esenciales por usted.</p>
                
                 <div className={`flex flex-col items-center border-4 border-dashed rounded-[2.5rem] p-10 text-center transition-all duration-500 cursor-pointer ${imagePreview ? 'border-brand-blue bg-blue-50/20' : 'border-brand-gray-100 bg-brand-gray-50/20 hover:bg-white hover:border-brand-blue/30 hover:scale-[1.01] hover:shadow-xl'}`}>
                    {imagePreview ? (
                        <div className="relative group/preview w-full max-w-sm">
                            <img src={imagePreview} alt="Comida seleccionada" className="w-full h-auto rounded-3xl mb-4 shadow-2xl border-4 border-white transform transition-transform duration-500 group-hover/preview:scale-[1.03]" />
                            <div className="absolute inset-0 bg-brand-blue/5 opacity-0 group-hover/preview:opacity-100 rounded-3xl transition-opacity pointer-events-none"></div>
                        </div>
                    ) : (
                        <div className="bg-brand-blue/5 text-brand-blue p-8 rounded-full mb-6 group-hover:scale-110 group-hover:bg-brand-blue group-hover:text-white transition-all duration-500 shadow-inner">
                            <UploadIcon />
                        </div>
                    )}
                    
                    <input type="file" id="food-upload" accept="image/*" className="hidden" onChange={handleFileChange} />
                    <label htmlFor="food-upload" className="cursor-pointer bg-brand-lightblue text-brand-blue font-black py-5 px-10 rounded-2xl text-[11px] uppercase tracking-widest hover:bg-brand-blue hover:text-white transition-all shadow-sm active:scale-95">
                        {selectedFile ? 'Cambiar Imagen' : 'Tomar Foto del Plato'}
                    </label>
                    {!selectedFile && <p className="text-[10px] font-black text-brand-gray-400 mt-6 uppercase tracking-widest opacity-60">Fomatos compatibles: JPG, PNG</p>}
                </div>
                
                {isLoading ? <div className="mt-8"><LoadingSpinner message={loadingMessage} /></div> : (
                    <button 
                        onClick={handleUpload} 
                        disabled={!selectedFile || !isAiEnabled} 
                        className="w-full mt-10 bg-brand-blue text-white text-xl font-black py-6 rounded-3xl shadow-soft hover:shadow-soft-lg active:scale-[0.98] transition-all disabled:bg-brand-gray-100 disabled:text-brand-gray-400 uppercase tracking-widest"
                    >
                        Ejecutar Análisis Nutricional
                    </button>
                )}
                 {error && <p className="text-center text-[10px] mt-6 text-brand-red p-5 bg-brand-soft-red rounded-2xl font-black uppercase tracking-widest shadow-sm">{error}</p>}
                 {successMessage && (
                    <div className="mt-6 p-6 bg-brand-soft-green text-brand-green rounded-2xl border border-brand-green/10 flex items-center justify-center gap-4 animate-fade-in shadow-sm">
                        <CheckCircleIcon className="w-6 h-6" />
                        <span className="font-black text-xs uppercase tracking-widest">{successMessage}</span>
                    </div>
                )}
            </div>

            <div className="space-y-10">
                <h2 className="text-[11px] font-black text-brand-gray-400 uppercase tracking-[0.4em] ml-2">Historial de Alimentación</h2>
                {nutritionalAnalyses.length === 0 ? (
                    <div className="bg-white p-24 rounded-[2.5rem] text-center shadow-soft border border-brand-gray-50">
                        <p className="text-brand-gray-400 font-black uppercase tracking-widest text-[11px]">No hay platos registrados todavía</p>
                    </div>
                ) : (
                    nutritionalAnalyses.map(item => (
                        <div key={item.id} className="bg-white p-8 rounded-[2.5rem] shadow-soft flex flex-col md:flex-row gap-10 animate-fade-in border border-brand-gray-50 hover:shadow-soft-lg transition-shadow">
                            <div className="w-full md:w-1/3 shrink-0">
                               <img src={item.imagePreview} alt="Registro de Comida" className="w-full h-auto object-cover rounded-[2.5rem] aspect-square shadow-xl border-4 border-white"/>
                               <div className="mt-6 text-center">
                                    <p className="text-[11px] font-black text-brand-gray-400 uppercase tracking-widest">{item.createdAt.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                    <p className="text-xs font-bold text-brand-gray-500 mt-1 uppercase tracking-widest opacity-60">{item.createdAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                               </div>
                            </div>
                            <div className="flex-1">
                                <AnalysisDisplay analysis={item.analysis} type="nutrition" />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default NutritionScreen;
