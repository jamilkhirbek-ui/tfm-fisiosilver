
import React from 'react';
import type { ClinicalAnalysisResult, NutritionalAnalysisResult, NutriScore } from '../types';
import { InfoCircleIcon, SparklesIcon, LightBulbIcon, AppleIcon } from './Icons';
import { NutritionRadarChart } from './NutritionCharts';

interface AnalysisDisplayProps {
    analysis: ClinicalAnalysisResult | NutritionalAnalysisResult;
    type: 'clinical' | 'nutrition';
}

const Card: React.FC<{ title: string, icon: React.ReactNode, children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="mb-10 last:mb-0">
        <div className="flex items-center gap-3 mb-5 ml-1">
            <div className="w-8 h-8 rounded-lg bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                {icon}
            </div>
            <h4 className="text-[11px] font-black text-brand-gray-400 uppercase tracking-[0.2em]">{title}</h4>
        </div>
        <div className="bg-white p-8 rounded-v-xl border border-brand-gray-100 shadow-soft transition-all duration-300 hover:shadow-premium group">
            {children}
        </div>
    </div>
);

const getNutriScoreStyle = (score: NutriScore) => {
    switch(score) {
        case 'A': return 'bg-green-gradient text-white';
        case 'B': return 'bg-emerald-500 text-white';
        case 'C': return 'bg-orange-gradient text-white';
        case 'D': return 'bg-orange-600 text-white';
        case 'E': return 'bg-red-gradient text-white';
        default: return 'bg-brand-gray-100 text-brand-gray-400';
    }
};

const Biomarker: React.FC<{ label: string, value?: string }> = ({ label, value }) => {
    const isMissing = !value || value.toLowerCase().includes('---') || value.toLowerCase().includes('encontrado');
    return (
        <div className="flex justify-between items-center py-4 border-b border-brand-gray-50 last:border-0 group/biomarker">
            <span className="text-xs font-bold text-brand-gray-500 uppercase tracking-tight group-hover/biomarker:text-brand-gray-900 transition-colors">{label}</span>
            <div className="flex items-baseline gap-1">
                <span className={`text-base font-black tracking-tighter ${isMissing ? 'text-brand-gray-200 italic' : 'text-brand-gray-900'}`}>
                    {isMissing ? '---' : value}
                </span>
            </div>
        </div>
    );
};

const ClinicalDisplay: React.FC<{ analysis: ClinicalAnalysisResult }> = ({ analysis }) => {
    // Si la estructura no es la esperada, evitamos el crash
    const biomarkers = analysis?.biomarkers || {};

    return (
        <div className="space-y-4">
            <Card title="Interpretación de la IA" icon={<InfoCircleIcon className="w-4 h-4" />}>
                <p className="text-sm font-medium text-brand-gray-600 leading-relaxed italic border-l-4 border-brand-blue/30 pl-6 py-2">
                    "{analysis?.summary || 'No se pudo generar un resumen.'}"
                </p>
            </Card>
            
            <Card title="Valores Detectados" icon={<SparklesIcon className="w-4 h-4" />}>
                <div className="grid grid-cols-1 divide-y divide-brand-gray-50">
                    <Biomarker label="Hemoglobina" value={biomarkers.hemoglobin} />
                    <Biomarker label="Albúmina" value={biomarkers.albumin} />
                    <Biomarker label="Glucosa en Ayunas" value={biomarkers.glucoseFasting} />
                    <Biomarker label="HbA1c" value={biomarkers.hba1c} />
                    <Biomarker label="Creatinina" value={biomarkers.creatinine} />
                    <Biomarker label="Colesterol LDL" value={biomarkers.ldl} />
                    <Biomarker label="Proteína C Reactiva" value={biomarkers.crp} />
                    <Biomarker label="Vitamina D" value={biomarkers.vitaminD} />
                </div>
            </Card>

            <Card title="Recomendaciones" icon={<LightBulbIcon className="w-4 h-4" />}>
                <div className="space-y-4">
                    {analysis?.recommendations && Array.isArray(analysis.recommendations) ? (
                        analysis.recommendations.map((r, i) => (
                            <div key={i} className="flex gap-4 items-start p-4 bg-brand-lightblue rounded-xl border border-brand-blue/10">
                                <div className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center text-[10px] font-black shrink-0">
                                    {i + 1}
                                </div>
                                <p className="text-xs font-bold text-brand-blue leading-relaxed tracking-tight">{r}</p>
                            </div>
                        ))
                    ) : (
                        <p className="text-[10px] text-brand-gray-400 italic">No hay recomendaciones para esta analítica.</p>
                    )}
                </div>
            </Card>
        </div>
    );
};

const MacroBar: React.FC<{ label: string, value?: string, color: string }> = ({ label, value, color }) => {
    const num = parseInt(value?.replace(/[^0-9]/g, '') || "0") || 0;
    const max = 100;
    const pct = Math.min(100, (num / max) * 100);
    return (
        <div className="mb-6 last:mb-0">
            <div className="flex justify-between text-[11px] font-black uppercase tracking-widest mb-2.5">
                <span className="text-brand-gray-400 leading-none">{label}</span>
                <span className="text-brand-gray-900 bg-brand-gray-50 px-2 py-1 rounded-lg leading-none">{value || '0g'}</span>
            </div>
            <div className="h-2.5 bg-brand-gray-100 rounded-full overflow-hidden shadow-inner">
                <div 
                    className={`${color} h-full transition-all duration-1000 ease-out relative`} 
                    style={{ width: `${pct}%` }}
                >
                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
            </div>
        </div>
    );
};

const NutritionDisplay: React.FC<{ analysis: NutritionalAnalysisResult }> = ({ analysis }) => {
    const macros = analysis?.macros || {};
    const scores = analysis?.nutritionScores || {};

    return (
        <div className="space-y-4">
            <div className="flex gap-4 mb-10">
                <div className="flex-1 bg-brand-gradient p-8 rounded-v-xl flex flex-col items-center justify-center shadow-premium relative overflow-hidden group/calories">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover/calories:scale-150 transition-transform duration-700" />
                    <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] relative z-10 mb-2">Energía Total</span>
                    <div className="relative z-10 flex items-baseline gap-2">
                        <span className="text-5xl font-black text-white tracking-tighter">{analysis?.calories?.replace(/[^0-9]/g, '') || '0'}</span>
                        <span className="text-sm font-extrabold text-white/60">kcal</span>
                    </div>
                </div>
            </div>

            {analysis?.nutritionScores && (
                <Card title="Calidad Nutricional (Detalle)" icon={<AppleIcon className="w-4 h-4" />}>
                   <div className="flex flex-col items-center">
                        <NutritionRadarChart scores={scores as any} size={280} />
                        <div className="mt-8 grid grid-cols-2 gap-x-12 gap-y-4 w-full border-t border-brand-gray-50 pt-8">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-brand-gray-400">NUTRI-SCORE</span>
                                <span className={`px-2 py-1 rounded text-xs font-black ${getNutriScoreStyle(analysis.nutriScore || 'C')}`}>
                                    {analysis.nutriScore || '---'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-brand-gray-400">ESTADO</span>
                                <span className="text-xs font-black text-brand-blue uppercase">Geriátrico</span>
                            </div>
                        </div>
                   </div>
                </Card>
            )}

            <Card title="Nutrientes Principales" icon={<SparklesIcon className="w-4 h-4" />}>
                <div className="space-y-2">
                    <MacroBar label="Proteínas" value={macros.protein} color="bg-brand-blue" />
                    <MacroBar label="Carbohidratos" value={macros.carbs} color="bg-brand-yellow" />
                    <MacroBar label="Grasas" value={macros.fatsTotal} color="bg-emerald-500" />
                </div>
            </Card>

            <Card title="Comentario Geriátrico" icon={<InfoCircleIcon className="w-4 h-4" />}>
                <p className="text-base font-bold text-brand-gray-700 leading-relaxed italic relative">
                    <span className="text-4xl text-brand-blue/20 absolute -top-4 -left-2 font-serif">"</span>
                    {analysis?.portions || 'Sin comentario disponible.'}
                </p>
                {analysis?.suggestions && Array.isArray(analysis.suggestions) && analysis.suggestions.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-brand-gray-50 flex flex-wrap gap-2">
                        {analysis.suggestions.map((s, i) => (
                            <span key={i} className="px-3 py-1.5 bg-brand-soft-green text-brand-green text-[10px] font-black uppercase tracking-widest rounded-lg border border-brand-green/10">
                                {s}
                            </span>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};

const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ analysis, type }) => {
    if (type === 'clinical') return <ClinicalDisplay analysis={analysis as ClinicalAnalysisResult} />;
    if (type === 'nutrition') return <NutritionDisplay analysis={analysis as NutritionalAnalysisResult} />;
    return null;
};

export default AnalysisDisplay;
