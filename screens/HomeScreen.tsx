
import React, { useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getDailyHistory, updateUserProfile, getUserProfile, getVigsHistory } from '../services/dbService';
import { predictMortality, predictHospitalization, predictCVRisk } from '../services/mlService';
import { generateWeeklyChallenges, generateDailySummary, explainClinicalData } from '../services/geminiService';
import type { DailySummary } from '../services/geminiService';
import type { VigsCategory, HealthData, UserProfile, SmokingStatus, NutriScore, ActivityLevel, Challenge } from '../types';
import { XMarkIcon, avatars, PencilSquareIcon, CheckCircleIcon, SparklesIcon, ActivityIcon, PlusIcon, ChevronRightIcon, HeartIcon, TrashIcon, UserIcon, AppleIcon, InfoCircleIcon, ArrowPathIcon, TrophyIcon, WrenchIcon, LightBulbIcon } from '../components/Icons';
import { NutritionRadarChart } from '../components/NutritionCharts';


const diaryOptions = [
    { id: 'weight', label: 'Peso Corporal (kg)' },
    { id: 'systolicBP', label: 'Tensión Sistólica (mmHg)' },
    { id: 'diastolicBP', label: 'Tensión Diastólica (mmHg)' },
    { id: 'pulse', label: 'Pulso (LPM)' },
    { id: 'oxygenSaturation', label: 'Saturación Oxígeno (%)' },
    { id: 'glucose', label: 'Azúcar en Sangre (mg/dl)' },
    { id: 'falls', label: 'Control de Caídas (nº)' },
    { id: 'calfCircumference', label: 'Pantorrilla (cm)' },
    { id: 'abdominalCircumference', label: 'Abdomen (cm)' },
];

const smokingOptions: { id: SmokingStatus; label: string }[] = [
    { id: 'Nunca', label: 'Nunca' },
    { id: 'Ex-fumador', label: 'Ex-fumador' },
    { id: 'Activo', label: 'Fumador' },
];

const getVigsColorClass = (category: VigsCategory): string => {
  switch (category) {
    case 'No frágil': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    case 'Fragilidad leve': return 'text-brand-blue bg-brand-lightblue border-blue-100';
    case 'Fragilidad moderada': return 'text-brand-yellow bg-brand-soft-yellow border-yellow-100';
    case 'Fragilidad severa': return 'text-brand-red bg-brand-soft-red border-red-100';
    default: return 'text-brand-gray-500 bg-brand-gray-100 border-brand-gray-200';
  }
};

const getNutriScoreColor = (score?: NutriScore): string => {
    switch (score) {
        case 'A': return 'green-gradient';
        case 'B': return 'green-gradient';
        case 'C': return 'orange-gradient';
        case 'D': return 'orange-gradient';
        case 'E': return 'red-gradient';
        default: return 'bg-brand-gray-200';
    }
};

interface ChartDataPoint { date: Date; value: number; }

const HistoryChart: React.FC<{ 
    data: ChartDataPoint[]; 
    color: string; 
    unit: string;
    range?: { min: number; max: number };
}> = ({ data, color, unit, range }) => {
    if (data.length === 0) return <div className="h-48 flex flex-col items-center justify-center bg-brand-gray-50 rounded-2xl border border-dashed border-brand-gray-200"><p className="text-brand-gray-400 text-[10px] font-bold uppercase tracking-[0.2em]">Sin historial de registros</p></div>;
    const width = 400; const height = 200; const px = 40; const py = 40;
    const values = data.map(d => d.value);
    let minV = Math.min(...values);
    let maxV = Math.max(...values);
    if (range) { minV = Math.min(minV, range.min); maxV = Math.max(maxV, range.max); }
    const buf = (maxV - minV) * 0.25 || 5;
    minV = Math.max(0, minV - buf); maxV = maxV + buf;
    const r = maxV - minV || 1;
    const getX = (i: number) => px + (i / Math.max(1, data.length - 1)) * (width - 2 * px);
    const getY = (v: number) => height - py - ((v - minV) / r) * (height - 2 * py);
    
    // Smoother path generation
    const points = data.map((d, i) => ({ x: getX(i), y: getY(d.value) }));
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${path} L ${points[points.length-1].x} ${height-py} L ${points[0].x} ${height-py} Z`;
    
    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible filter drop-shadow-sm">
            <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            {range && (
                <g>
                    {/* Franja de rango óptimo */}
                    <rect 
                        x={px} 
                        y={getY(range.max)} 
                        width={width - 2 * px} 
                        height={Math.max(2, Math.abs(getY(range.min) - getY(range.max)))} 
                        fill="rgba(16,185,129,0.12)" 
                        rx="4" 
                    />
                    {/* Líneas de límite */}
                    <line x1={px} y1={getY(range.max)} x2={width-px} y2={getY(range.max)} stroke="#10B981" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                    <line x1={px} y1={getY(range.min)} x2={width-px} y2={getY(range.min)} stroke="#10B981" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                    
                    {/* Etiquetas de valores límite */}
                    <text x={px - 6} y={getY(range.max)} textAnchor="end" dominantBaseline="middle" className="text-[9px] font-black fill-brand-green">{range.max}</text>
                    <text x={px - 6} y={getY(range.min)} textAnchor="end" dominantBaseline="middle" className="text-[9px] font-black fill-brand-green">{range.min}</text>
                    
                    {/* Texto lateral indicativo */}
                    <text 
                        x={width - px + 8} 
                        y={getY((range.min + range.max) / 2)} 
                        dominantBaseline="middle" 
                        className="text-[7px] font-black fill-brand-green uppercase tracking-[0.2em]" 
                        style={{ writingMode: 'vertical-rl' }}
                    >
                        Rango Óptimo
                    </text>
                </g>
            )}
            <path d={areaPath} fill="url(#chartGradient)" />
            <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {data.map((d, i) => (
                <g key={i} className="group/dot">
                    <circle cx={getX(i)} cy={getY(d.value)} r="6" fill={color} opacity="0" className="group-hover/dot:opacity-20 transition-opacity cursor-pointer" />
                    <circle cx={getX(i)} cy={getY(d.value)} r="3" fill="white" stroke={color} strokeWidth="2.5" />
                </g>
            ))}
            <text x={px} y={height - 15} className="text-[9px] font-bold fill-brand-gray-400">{data[0].date.toLocaleDateString()}</text>
            <text x={width - px} y={height - 15} textAnchor="end" className="text-[9px] font-bold fill-brand-gray-400">{data[data.length-1].date.toLocaleDateString()}</text>
        </svg>
    );
};

const IndexCard: React.FC<{ 
    title: string; value: string | number; percent: number; 
    description: string; inverted?: boolean; category?: string; categoryClass?: string;
    onClick?: () => void; customColor?: string;
}> = ({ title, value, percent, description, inverted = false, category, categoryClass, onClick, customColor }) => {
    const getColor = (p: number) => {
        if (customColor) return customColor;
        if (inverted) return p > 70 ? 'bg-brand-green' : p > 40 ? 'bg-brand-yellow' : 'bg-brand-red';
        return p < 30 ? 'bg-brand-green' : p < 60 ? 'bg-brand-yellow' : 'bg-brand-red';
    };
    
    return (
        <button 
            onClick={onClick} 
            className="group relative bg-white p-6 rounded-v-xl shadow-soft border border-brand-gray-100 flex flex-col justify-between min-h-[220px] transition-all duration-300 hover:shadow-premium hover:-translate-y-1 text-left w-full active:scale-[0.98]"
        >
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-3">
                    <h2 className="text-[11px] font-bold text-brand-gray-400 uppercase tracking-[0.15em]">{title}</h2>
                    {category && (
                        <div className={`px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider border ${categoryClass}`}>
                            {category}
                        </div>
                    )}
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-5xl font-black text-brand-gray-900 tracking-tighter leading-none group-hover:text-brand-blue transition-colors">
                        {value}
                    </span>
                </div>
            </div>
            
            <div className="space-y-3 relative z-10">
                <p className="text-brand-gray-500 text-[11px] font-medium leading-relaxed italic opacity-80">
                    {description}
                </p>
                <div className="w-full h-1.5 bg-brand-gray-100 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-1000 ease-out ${getColor(percent).includes('-gradient') ? `bg-${getColor(percent)}` : getColor(percent)}`} 
                        style={{ width: `${Math.max(5, percent)}%` }} 
                    />
                </div>
            </div>
            
            {/* Ambient Background Accent */}
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-brand-blue/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
    );
};

const HomeScreen: React.FC = () => {
    const { user, signOut } = useAuth();
    const { 
        healthData, setHealthData, 
        setDiaryPreferences, diaryPreferences, 
        setVigsScore, vigsScore,
        predictions, setPredictions,
        clinicalAnalyses, nutritionalAnalyses,
        currentProfile, setCurrentProfile,
    } = useContext(AppContext)!;
    const [profile, setProfile] = useState<UserProfile | null>(currentProfile);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    
    // Deivamos estos valores de la fuente de verdad global (contexto)
    const latestNutriScore = useMemo(() => nutritionalAnalyses[0]?.analysis.nutriScore, [nutritionalAnalyses]);
    const recentMealDescriptions = useMemo(() => nutritionalAnalyses.slice(0, 3).map(n => n.analysis.portions || 'Comida registrada'), [nutritionalAnalyses]);
    
    const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [lastFeatures, setLastFeatures] = useState<number[]>([]);
    const [selectedDetail, setSelectedDetail] = useState<{ label: string, key: string, unit: string, range?: {min: number, max: number} } | null>(null);
    const [detailHistory, setDetailHistory] = useState<ChartDataPoint[]>([]);
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [isLoadingChallenges, setIsLoadingChallenges] = useState(false);
    const [challengesError, setChallengesError] = useState<string | null>(null);
    const isRunningPredictionsRef = React.useRef(false);

    const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
    const [isLoadingSummary, setIsLoadingSummary] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [clinicalExplanation, setClinicalExplanation] = useState<string | null>(null);
    const [clinicalExplanationError, setClinicalExplanationError] = useState<string | null>(null);
    const [isLoadingClinicalExp, setIsLoadingClinicalExp] = useState(false);
    const [dailyHistory, setDailyHistory] = useState<(HealthData & { createdAt: Date })[]>([]);

    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [editName, setEditName] = useState("");
    const [editAge, setEditAge] = useState("");
    const [editHeight, setEditHeight] = useState("");
    const [editGender, setEditGender] = useState<'male' | 'female'>('male');
    const [editSmoking, setEditSmoking] = useState<SmokingStatus>("Nunca");
    const [editPrefs, setEditPrefs] = useState<(keyof HealthData)[]>([]);

    const hasRealData = useMemo(() => {
        return clinicalAnalyses.length > 0 || 
               nutritionalAnalyses.length > 0 || 
               healthData.systolicBP !== null || 
               healthData.glucose !== null || 
               healthData.weight !== null ||
               healthData.pulse !== null;
    }, [clinicalAnalyses, nutritionalAnalyses, healthData]);

    const calculatedIndices = useMemo(() => {
        const vigs = vigsScore.index || (vigsScore.score / 25);
        const sys = healthData.systolicBP || 120;
        const falls = healthData.falls || 0;
        const calf = healthData.calfCircumference || 34;
        const edad = profile?.age || 75;
        
        const smokeFactor = profile?.smokingStatus === 'Activo' ? 20 : profile?.smokingStatus === 'Ex-fumador' ? 5 : 0;
        const prot = Math.max(0, Math.min(100, (1 - vigs) * 100));
        const cvRisk = Math.min(100, ((sys - 110) / 70 * 80) + smokeFactor);
        
        // --- CÁLCULO MATEMÁTICO RIESGO DE CAÍDAS (Propuesta 1) ---
        const vigsPoints = vigs * 50;
        const historyPoints = (falls > 0) ? 20 : 0;
        const sarcopeniaPoints = (calf < 31) ? 15 : 0;
        const agePoints = Math.min(10, Math.max(0, (edad - 65) / 30 * 10));
        const fallRisk = Math.min(100, vigsPoints + historyPoints + sarcopeniaPoints + agePoints);
        
        let nutriPercent = 0;
        if (latestNutriScore === 'A') nutriPercent = 100;
        else if (latestNutriScore === 'B') nutriPercent = 80;
        else if (latestNutriScore === 'C') nutriPercent = 60;
        else if (latestNutriScore === 'D') nutriPercent = 40;
        else if (latestNutriScore === 'E') nutriPercent = 20;

        return { autonomy: vigs * 100, protection: prot, cardio: cvRisk, falls: fallRisk, nutrition: nutriPercent };
    }, [vigsScore, healthData, profile, latestNutriScore]);

    const loadProfile = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const pData = await getUserProfile(user.uid);
            if (pData) {
                setProfile(pData);
                setCurrentProfile(pData);
                setHealthData(pData.healthData);
                setDiaryPreferences(pData.diaryPreferences);
                setVigsScore(pData.vigsScore);
                setEditName(pData.displayName);
                setEditAge(pData.age.toString());
                setEditHeight(pData.healthData.height?.toString() || "170");
                setEditGender(pData.gender);
                setEditSmoking(pData.smokingStatus);
                setEditPrefs(pData.diaryPreferences);
            }

            // Load daily history for sparklines
            const history = await getDailyHistory(user.uid);
            setDailyHistory(history);
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    useEffect(() => { loadProfile(); }, [user]);
    useEffect(() => { setProfile(currentProfile); }, [currentProfile]);

    // PASO 1: Cargar resumen y retos cacheados INMEDIATAMENTE al montar
    useEffect(() => {
        if (!user) return;
        const cachedSummary = localStorage.getItem(`dailySummary_v2_${user.uid}`);
        if (cachedSummary) {
            try { 
                setDailySummary(JSON.parse(cachedSummary)); 
                console.log("[CACHE] Resumen cargado del almacenamiento local.");
            } catch {}
        }
        const cachedChallenges = localStorage.getItem(`challenges_v2_${user.uid}`);
        if (cachedChallenges) {
            try { setChallenges(JSON.parse(cachedChallenges)); } catch {}
        }
    }, [user.uid]);

    // Función manual para generar el resumen
    const handleGenerateSummary = useCallback(async () => {
        if (isLoadingSummary || isLoading || !profile || !user) return;
        setSummaryError(null);

        // Generamos el hash actual para guardarlo junto al resumen
        const currentHash = [
            healthData.weight ?? 'x',
            healthData.systolicBP ?? 'x',
            healthData.diastolicBP ?? 'x',
            healthData.pulse ?? 'x',
            healthData.glucose ?? 'x',
            healthData.oxygenSaturation ?? 'x',
            healthData.calfCircumference ?? 'x',
            healthData.abdominalCircumference ?? 'x',
            healthData.falls ?? 'x',
            vigsScore.score,
            clinicalAnalyses.length,
            nutritionalAnalyses.length
        ].join('|');

        // CALCULAMOS LOS ÚLTIMOS VALORES CONOCIDOS (Merging history)
        const latestKnownValues: HealthData = { ...healthData };
        if (dailyHistory.length > 0) {
            const sortedHistory = [...dailyHistory].sort((a, b) => 
                (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0)
            );

            const keys: (keyof HealthData)[] = [
                'weight', 'systolicBP', 'diastolicBP', 'pulse', 'glucose', 
                'oxygenSaturation', 'calfCircumference', 'abdominalCircumference', 'falls'
            ];

            keys.forEach(key => {
                if (latestKnownValues[key] === null) {
                    const lastEntryWithData = sortedHistory.find(entry => entry[key] !== null);
                    if (lastEntryWithData) {
                        (latestKnownValues as any)[key] = lastEntryWithData[key];
                    }
                }
            });
        }

        console.log("[IA] Solicitando nuevo resumen técnico...");
        setIsLoadingSummary(true);
        try {
            const biomarkers = clinicalAnalyses.length > 0 ? clinicalAnalyses[0].analysis.biomarkers as unknown as Record<string, string> : null;
            const summary = await generateDailySummary(profile, latestKnownValues, vigsScore, recentMealDescriptions, biomarkers);
            
            if (summary) {
                setDailySummary(summary);
                localStorage.setItem(`summaryHash_v2_${user.uid}`, `manual_${Date.now()}`);
                localStorage.setItem(`dailySummary_v2_${user.uid}`, JSON.stringify(summary));
            } else {
                setSummaryError('No se pudo generar el resumen IA. Inténtalo de nuevo.');
            }
        } catch (e) {
            console.error('[SUMMARY ERROR]', e);
            setSummaryError('No se pudo generar el resumen IA. Inténtalo de nuevo.');
        } finally {
            setIsLoadingSummary(false);
        }
    }, [user, profile, healthData, vigsScore, clinicalAnalyses, nutritionalAnalyses, dailyHistory, recentMealDescriptions, isLoadingSummary, isLoading]);

    useEffect(() => {
        console.log("Predictions state updated:", predictions);
    }, [predictions]);

    const runPredictions = useCallback(async () => {
        // Evitar re-entrada si ya se está ejecutando
        if (isRunningPredictionsRef.current) {
            console.log("Predictions already in progress, skipping...");
            return;
        }

        // Permitimos ejecutar si tenemos healthData y vigsScore
        if (!healthData || !vigsScore) {
            console.log("Predictions skipped: missing healthData or vigsScore");
            return;
        }
        
        isRunningPredictionsRef.current = true;
        setIsLoadingPredictions(true);
        console.log("--- INICIO PREDICCIÓN IA ---");
        
        try {
            // Verificamos si hay datos reales para predecir. 
            // Si no hay analíticas ni registros de tensión, devolvemos 0 para no confundir al usuario nuevo.
            const hasClinicalData = clinicalAnalyses.length > 0;
            const hasDailyData = healthData.systolicBP !== null || healthData.glucose !== null || healthData.calfCircumference !== null;
            
            if (!hasClinicalData && !hasDailyData) {
                console.log("No real data found, setting predictions to 0");
                setPredictions({
                    mortality: 0,
                    hospitalization: 0,
                    cvRisk: 0,
                    fallsRisk: 0,
                    lastUpdated: new Date().toLocaleTimeString()
                });
                return;
            }

            // Valores por defecto seguros si faltan datos
            const latestClinical = clinicalAnalyses.length > 0 ? clinicalAnalyses[0].analysis.biomarkers : null;
            
            const parseVal = (val: string | undefined | null) => {
                if (!val || val === '---') return null;
                const num = parseFloat(val.toString().replace(',', '.'));
                return isNaN(num) ? null : num;
            };

            const edad = profile?.age || 75;
            const vigsIndex = vigsScore.index !== undefined ? vigsScore.index : (vigsScore.score / 25) || 0;
            const albumin = parseVal(latestClinical?.albumin) || 4.0;
            const calf = healthData.calfCircumference || 34;
            const hemoglobin = parseVal(latestClinical?.hemoglobin) || 13.5;
            const pcr = parseVal(latestClinical?.crp) || 0.5;
            const vitD = parseVal(latestClinical?.vitaminD) || 30;
            const creatinine = parseVal(latestClinical?.creatinine) || 0.9;
            const tas = healthData.systolicBP || 120;
            const ldl = parseVal(latestClinical?.ldl) || 100;
            const hba1c = parseVal(latestClinical?.hba1c) || 5.7;

            const features = [
                edad, vigsIndex, albumin, calf, hemoglobin, pcr, vitD, creatinine, tas, ldl, hba1c
            ];

            console.log("Features prepared:", {
                edad, vigsIndex, albumin, calf, hemoglobin, pcr, vitD, creatinine, tas, ldl, hba1c
            });
            setLastFeatures(features);

            // Ejecutamos secuencialmente para evitar conflictos de sesión en algunos navegadores
            const m = await predictMortality(features).catch(err => { console.error("Mortality model failed:", err); return 0; });
            const h = await predictHospitalization(features).catch(err => { console.error("Hospitalization model failed:", err); return 0; });
            const cv = await predictCVRisk(features).catch(err => { console.error("CV Risk model failed:", err); return 0; });
            
            // --- CÁLCULO MATEMÁTICO RIESGO DE CAÍDAS (Propuesta 1) ---
            const vigsPoints = vigsIndex * 50;
            const historyPoints = (healthData.falls && healthData.falls > 0) ? 20 : 0;
            const sarcopeniaPoints = (healthData.calfCircumference && healthData.calfCircumference < 31) ? 15 : 0;
            const agePoints = Math.min(10, Math.max(0, (edad - 65) / 30 * 10));
            const fallsRiskCalc = Math.min(100, vigsPoints + historyPoints + sarcopeniaPoints + agePoints);

            console.log("RAW MODEL OUTPUTS:", { m, h, cv, fallsRiskCalc });

            // Aseguramos que los valores sean coherentes (0-100%)
            const clamp = (val: number) => {
                // Si el valor es muy pequeño pero no cero, aseguramos que se vea algo
                if (val > 0 && val < 0.001) return 0.1;
                if (val > 1) return Math.min(100, val);
                return Math.max(0, Math.min(100, val * 100));
            };

            const newPredictions = {
                mortality: clamp(m),
                hospitalization: clamp(h),
                cvRisk: clamp(cv),
                fallsRisk: clamp(fallsRiskCalc / 100), // clamp espera 0-1 o 0-100, fallsRiskCalc es 0-100
                lastUpdated: new Date().toLocaleTimeString()
            };

            console.log("Setting new predictions:", newPredictions);
            setPredictions(newPredictions);

        } catch (e) {
            console.error("Critical error in prediction pipeline:", e);
        } finally {
            isRunningPredictionsRef.current = false;
            setIsLoadingPredictions(false);
            console.log("--- FIN PREDICCIÓN IA ---");
        }
    }, [healthData, vigsScore, profile, clinicalAnalyses, setPredictions]);

    const handleFetchChallenges = useCallback(async () => {
        if (!healthData || !vigsScore || !profile || !user || isLoadingChallenges) return;
        setChallengesError(null);
        setIsLoadingChallenges(true);
        try {
            console.log("[IA] Solicitando retos semanales...");
            const newChallenges = await generateWeeklyChallenges(healthData, vigsScore, profile);
            setChallenges(newChallenges);
            localStorage.setItem(`challenges_v2_${user.uid}`, JSON.stringify(newChallenges));
        } catch (e) {
            console.error("Error fetching challenges:", e);
            setChallengesError('No se pudieron generar los retos IA. Inténtalo de nuevo.');
        } finally {
            setIsLoadingChallenges(false);
        }
    }, [healthData, vigsScore, profile, user, isLoadingChallenges]);

    const handleToggleChallenge = async (challengeId: string) => {
        if (!profile || !user) return;
        const newChallenges = challenges.map(c => {
            if (c.id === challengeId) {
                const isNowCompleted = !c.completed;
                if (isNowCompleted) {
                    const totalPoints = (profile.points || 0) + c.points;
                    const newLevel = Math.floor(totalPoints / 500) + 1;
                    updateUserProfile(user.uid, { points: totalPoints, level: newLevel });
                    setProfile(prev => prev ? { ...prev, points: totalPoints, level: newLevel } : null);
                    setSuccessMessage(`¡Excelente! +${c.points} puntos ganados.`);
                    setTimeout(() => setSuccessMessage(null), 3000);
                }
                return { ...c, completed: isNowCompleted };
            }
            return c;
        });
        setChallenges(newChallenges);
        localStorage.setItem(`challenges_v2_${user.uid}`, JSON.stringify(newChallenges));
    };

    const handleExplainClinical = useCallback(async () => {
        if (clinicalAnalyses.length === 0 || isLoadingClinicalExp) return;
        setClinicalExplanationError(null);
        setClinicalExplanation(null);
        setIsLoadingClinicalExp(true);
        try {
            const exp = await explainClinicalData(clinicalAnalyses[0].analysis.biomarkers);
            setClinicalExplanation(exp);
        } catch (e) {
            console.error("Error explaining clinical data:", e);
            setClinicalExplanationError('No se pudo generar la explicación IA. Inténtalo de nuevo.');
        } finally {
            setIsLoadingClinicalExp(false);
        }
    }, [clinicalAnalyses, isLoadingClinicalExp]);

    useEffect(() => {
        // Ejecutamos si tenemos los datos mínimos, el profile es opcional para el tabaquismo
        if (healthData && vigsScore) {
            runPredictions();
        }
    }, [runPredictions]);

    const handleSaveProfile = async () => {
        if (!user) return;
        try {
            const ageNum = parseInt(editAge);
            const heightNum = parseFloat(editHeight.replace(',', '.'));
            
            await updateUserProfile(user.uid, {
                displayName: editName,
                age: isNaN(ageNum) ? 75 : ageNum,
                gender: editGender,
                smokingStatus: editSmoking,
                diaryPreferences: editPrefs,
                healthData: { ...healthData, height: isNaN(heightNum) ? 170 : heightNum }
            });
            await loadProfile();
            setSuccessMessage("Perfil actualizado correctamente.");
            setTimeout(() => setSuccessMessage(null), 3000);
            setIsEditing(false);
            setIsProfileOpen(false);
        } catch (e: any) { 
            console.error(e);
            alert("Error al actualizar perfil: " + (e.message || "Error desconocido")); 
        }
    };

    const handleDetail = async (label: string, key: string, unit: string, range?: {min: number, max: number}) => {
        if (!user) return;
        setSelectedDetail({ label, key, unit, range });
        try {
            if (key === 'vigs') {
                const hist = await getVigsHistory(user.uid);
                setDetailHistory(hist.map(h => ({ date: h.createdAt, value: h.index })).reverse());
            } else if (key === 'systolicBP' || key === 'diastolicBP' || key === 'weight' || key === 'pulse' || key === 'glucose' || key === 'oxygenSaturation') {
                const logs = await getDailyHistory(user.uid);
                setDetailHistory(logs.map(l => ({ date: l.createdAt, value: l[key as keyof HealthData] as number })).filter(d => d.value !== null).reverse());
            } else if (key === 'cardio') {
                const logs = await getDailyHistory(user.uid);
                const sFactor = profile?.smokingStatus === 'Activo' ? 20 : profile?.smokingStatus === 'Ex-fumador' ? 5 : 0;
                setDetailHistory(logs.map(l => ({ date: l.createdAt, value: Math.min(100, (( (l.systolicBP || 120) - 110) / 70 * 80) + sFactor) })).reverse());
            } else {
                setDetailHistory([]);
            }
        } catch (e) { console.error(e); }
    };

    const AvatarComponent = profile ? avatars[profile.avatarId] || avatars[0] : avatars[0];

    if (isLoading) return <div className="flex h-screen items-center justify-center bg-brand-bg"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div></div>;

    return (
        <div className="p-6 max-w-6xl mx-auto pb-32 animate-fade-in">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-16 pt-8">
                <div className="animate-slide-up flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-brand-blue animate-pulse" />
                        <p className="text-brand-gray-400 font-bold uppercase tracking-[0.3em] text-[10px]">Monitor de Salud Inteligente</p>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-brand-gray-900 tracking-tight leading-tight break-words">
                        Hola de nuevo, <br/>
                        <span className="bg-brand-gradient bg-clip-text text-transparent">
                            {profile?.displayName?.split(' ')[0] || 'Paciente'}
                        </span>
                    </h1>
                </div>
                <div className="flex flex-col items-end gap-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <button 
                        onClick={() => { setIsProfileOpen(true); setIsEditing(false); }} 
                        className="group relative"
                    >
                        <div className="absolute inset-0 bg-brand-blue rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                        <div className="relative bg-white p-1 rounded-full shadow-premium border-2 border-white transition-transform group-hover:scale-105 active:scale-95">
                            <AvatarComponent className="w-20 h-20" />
                        </div>
                    </button>
                    <div className="text-right flex items-center gap-4 sm:gap-6">
                        <div className="hidden sm:block">
                            <p className="text-[10px] font-black text-brand-gray-300 uppercase tracking-widest leading-none mb-1 text-center">Nivel</p>
                            <div className="flex items-center justify-center bg-brand-gradient rounded-full w-10 h-10 shadow-premium">
                                <span className="text-white font-black text-lg">{profile?.level || 1}</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-brand-gray-300 uppercase tracking-widest leading-none mb-1">Puntos XP</p>
                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-soft border border-brand-gray-50">
                                <TrophyIcon className="w-5 h-5 text-brand-yellow" />
                                <span className="text-sm font-black text-brand-gray-900">{profile?.points || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {successMessage && (
                <div className="mb-8 p-4 bg-brand-soft-green text-brand-green rounded-2xl border border-brand-green/10 font-black text-center uppercase text-[10px] tracking-widest animate-fade-in">
                    {successMessage}
                </div>
            )}

            {/* ══════════ AI DAILY SUMMARY CARD ══════════ */}
            <section className="mb-12 bg-white rounded-[2.5rem] shadow-premium-lg border border-brand-gray-100 overflow-hidden">
                <div className="bg-brand-gradient p-8 pb-12 relative">
                    <div className="absolute top-4 right-6 flex items-center gap-2">
                        <SparklesIcon className="w-5 h-5 text-white/60" />
                        <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">IA Activa</span>
                    </div>
                    <h2 className="text-white text-3xl font-black tracking-tighter">
                        {!hasRealData ? '¡Bienvenido a Fisiosilver!' : (isLoadingSummary ? 'Analizando tu salud...' : (dailySummary?.greeting || 'Resumen IA pendiente'))}
                    </h2>
                    {!hasRealData ? (
                        <p className="text-white/80 text-base font-bold mt-3 leading-relaxed max-w-2xl">
                            Comience insertando sus datos de salud en el diario o subiendo una analítica para obtener feedback personalizado.
                        </p>
                    ) : (
                        <div className="space-y-4 mt-3">
                            {dailySummary ? (
                                <>
                                <p className="text-white/80 text-base font-bold leading-relaxed max-w-2xl">
                                    {dailySummary.narrative}
                                </p>
                                {dailySummary.analyticsSummary && (
                                    <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10 max-w-2xl animate-fade-in">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs">🩺</span>
                                            <p className="text-[9px] font-black text-white/60 uppercase tracking-widest">Resumen Analítico</p>
                                        </div>
                                        <p className="text-sm font-bold text-white leading-relaxed">
                                            {dailySummary.analyticsSummary}
                                        </p>
                                    </div>
                                )}
                                </>
                            ) : (
                                <p className="text-white/80 text-base font-bold leading-relaxed max-w-2xl">
                                    Genera el resumen IA para ver tu estado general.
                                </p>
                            )}

                            {summaryError && (
                                <div className="bg-white/15 backdrop-blur-sm p-4 rounded-2xl border border-white/20 max-w-2xl animate-fade-in">
                                    <p className="text-sm font-bold text-white leading-relaxed">
                                        {summaryError}
                                    </p>
                                </div>
                            )}

                            <div className="pt-2">
                                <button
                                    onClick={handleGenerateSummary}
                                    disabled={isLoadingSummary}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 transition-all active:scale-95 group/btn ${isLoadingSummary ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <ArrowPathIcon className={`w-4 h-4 text-white ${isLoadingSummary ? 'animate-spin' : 'group-hover/btn:rotate-180 transition-transform duration-500'}`} />
                                    <span className="text-[11px] font-black text-white uppercase tracking-widest">
                                        {isLoadingSummary ? 'Generando resumen...' : dailySummary ? 'Actualizar mi informe de salud con IA' : 'Generar resumen IA'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-8 -mt-6 relative">
                    {!hasRealData ? (
                        <div className="bg-brand-lightblue p-6 rounded-2xl flex items-center gap-4 border border-brand-blue/10">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-soft">
                                <PlusIcon className="w-6 h-6 text-brand-blue" />
                            </div>
                            <p className="text-brand-blue font-bold text-sm">Inserte datos en su diario o suba informes para activar su asistente IA.</p>
                        </div>
                    ) : (
                        <>
                            {/* Mood + Quick Tip */}
                            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                        <div className="flex items-center gap-3 bg-brand-gray-50 px-5 py-3 rounded-2xl">
                            <span className="text-3xl">{dailySummary?.mood === 'great' ? '😊' : dailySummary?.mood === 'good' ? '🙂' : dailySummary?.mood === 'okay' ? '😐' : dailySummary?.mood === 'watch' ? '⚠️' : '💙'}</span>
                            <div>
                                <p className="text-[9px] font-black text-brand-gray-400 uppercase tracking-widest">Estado General</p>
                                <p className="text-sm font-black text-brand-gray-900 capitalize">{dailySummary?.mood === 'great' ? 'Excelente' : dailySummary?.mood === 'good' ? 'Bien' : dailySummary?.mood === 'okay' ? 'Estable' : dailySummary?.mood === 'watch' ? 'Vigilar' : isLoadingSummary ? 'Generando...' : 'Resumen pendiente'}</p>
                            </div>
                        </div>
                        <div className="flex-1 bg-brand-lightblue px-5 py-3 rounded-2xl flex items-center gap-3">
                            <span className="text-xl">💡</span>
                            <p className="text-sm font-bold text-brand-blue">
                                {dailySummary?.quickTip || 'Genera el resumen IA para ver tu estado general.'}
                            </p>
                        </div>
                    </div>
                    {/* Highlights */}
                    {dailySummary?.highlights && dailySummary.highlights.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {dailySummary.highlights.map((h, i) => (
                                <div key={i} className={`p-4 rounded-2xl border-2 transition-transform hover:scale-[1.02] ${
                                    h.status === 'positive' ? 'bg-brand-soft-green border-brand-green/20' :
                                    h.status === 'warning' ? 'bg-brand-soft-yellow border-brand-yellow/20' :
                                    'bg-brand-gray-50 border-brand-gray-100'
                                }`}>
                                    <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${
                                        h.status === 'positive' ? 'text-brand-green' :
                                        h.status === 'warning' ? 'text-brand-yellow' : 'text-brand-gray-400'
                                    }`}>{h.label}</p>
                                    <p className="text-xs font-bold text-brand-gray-700">{h.detail}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    {isLoadingSummary && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {[1,2,3,4,5,6].map(i => <div key={i} className="h-24 bg-brand-gray-50 rounded-2xl animate-pulse" />)}
                        </div>
                        )}
                    </>
                )}
                </div>
            </section>

            {/* ══════════ VITALITY RING + KEY INDICES ══════════ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {/* Vitality Ring */}
                <div className="bg-white p-8 rounded-[2rem] shadow-soft border border-brand-gray-100 flex flex-col items-center justify-center">
                    <div className="relative w-36 h-36 mb-4">
                        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
                            <circle cx="70" cy="70" r="60" fill="none" stroke="#F3F4F6" strokeWidth="12" />
                            <circle cx="70" cy="70" r="60" fill="none" stroke="url(#vitalGrad)" strokeWidth="12"
                                strokeDasharray={`${calculatedIndices.protection * 3.77} 377`}
                                strokeLinecap="round" className="transition-all duration-1000" />
                            <defs><linearGradient id="vitalGrad" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#0062E3"/><stop offset="1" stopColor="#10B981"/></linearGradient></defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-4xl font-black text-brand-gray-900">{Math.round(calculatedIndices.protection)}</span>
                            <span className="text-[9px] font-black text-brand-gray-400 uppercase tracking-widest">Vitalidad</span>
                        </div>
                    </div>
                    <p className="text-sm font-bold text-brand-gray-500 text-center italic">
                        {calculatedIndices.protection > 70 ? '¡Excelente nivel de energía!' : calculatedIndices.protection > 40 ? 'Buen equilibrio general.' : 'Hay margen de mejora.'}
                    </p>
                </div>
                {/* VIGS Card */}
                <button onClick={() => handleDetail('Autonomía', 'vigs', 'VIGS', {min: 0, max: 0.2})} className="bg-white p-8 rounded-[2rem] shadow-soft border border-brand-gray-100 text-left group hover:shadow-premium transition-all">
                    <p className="text-[9px] font-black text-brand-gray-400 uppercase tracking-widest mb-2">Autonomía (VIGS)</p>
                    <p className="text-5xl font-black text-brand-gray-900 tracking-tighter mb-3 group-hover:text-brand-blue transition-colors">{vigsScore.index?.toFixed(2) || '0.00'}</p>
                    <div className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${getVigsColorClass(vigsScore.category)}`}>{vigsScore.category}</div>
                    <p className="text-xs font-bold text-brand-gray-500 mt-4 italic">Su independencia funcional medida con 25 variables clínicas.</p>
                </button>
                {/* Nutrition Radar Card */}
                <div className="bg-white p-8 rounded-[2rem] shadow-soft border border-brand-gray-100 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-[9px] font-black text-brand-gray-400 uppercase tracking-widest">Equilibrio Nutricional</p>
                        {latestNutriScore && (
                            <div className={`px-2 py-0.5 rounded text-[8px] font-black text-white ${
                                latestNutriScore <= 'B' ? 'bg-brand-green' : latestNutriScore <= 'C' ? 'bg-brand-yellow' : 'bg-brand-red'
                            }`}>
                                NUTRI {latestNutriScore}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 flex items-center justify-center p-2">
                        {nutritionalAnalyses.length > 0 && nutritionalAnalyses[0].analysis.nutritionScores ? (
                            <NutritionRadarChart scores={nutritionalAnalyses[0].analysis.nutritionScores} size={150} />
                        ) : (
                            <div className="text-center py-10 opacity-30">
                                <AppleIcon className="w-12 h-12 mx-auto mb-2" />
                                <p className="text-[10px] font-black uppercase tracking-widest leading-tight">Sin datos<br/>del plato</p>
                            </div>
                        )}
                    </div>
                    <p className="text-xs font-bold text-brand-gray-500 mt-4 italic text-center leading-tight">Balance de su última comida analizada por IA.</p>
                </div>
            </div>

            {/* ══════════ CLINICAL INSIGHTS STRIP ══════════ */}
            {clinicalAnalyses.length > 0 && (
                <section className="mb-12">
                    <h2 className="text-[11px] font-black text-brand-gray-400 uppercase tracking-[0.4em] mb-6 ml-2">Últimos Datos Clínicos</h2>
                    <div className="bg-white rounded-[2rem] shadow-soft border border-brand-gray-100 p-6 overflow-x-auto">
                        <div className="flex gap-4 min-w-max">
                            {Object.entries(clinicalAnalyses[0].analysis.biomarkers).filter(([_, v]) => v && v !== '---' && v !== 'No encontrado').slice(0, 8).map(([key, val]) => {
                                const labels: Record<string, string> = { hemoglobin: 'Hemoglobina', albumin: 'Albúmina', vitaminD: 'Vit. D', glucoseFasting: 'Glucosa', creatinine: 'Creatinina', crp: 'PCR', sodium: 'Sodio', tsh: 'TSH', vitaminB12: 'Vit. B12', ldl: 'LDL', hba1c: 'HbA1c', egfr: 'eGFR' };
                                return (
                                    <div key={key} className="bg-brand-gray-50 px-5 py-4 rounded-2xl min-w-[120px] text-center hover:bg-brand-lightblue transition-colors">
                                        <p className="text-[8px] font-black text-brand-gray-400 uppercase tracking-widest mb-1">{labels[key] || key}</p>
                                        <p className="text-xl font-black text-brand-gray-900">{val}</p>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-5 border-t border-brand-gray-50 pt-4">
                            {isLoadingClinicalExp ? (
                                <div className="bg-brand-gray-50 p-6 rounded-2xl animate-fade-in border border-brand-gray-100">
                                    <div className="flex items-center gap-2">
                                        <LightBulbIcon className="w-4 h-4 text-brand-blue animate-pulse" />
                                        <p className="text-[10px] font-black text-brand-blue uppercase tracking-widest">Generando explicación...</p>
                                    </div>
                                </div>
                            ) : clinicalExplanation ? (
                                <div className="bg-brand-gray-50 p-6 rounded-2xl animate-fade-in border border-brand-gray-100">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-2 h-2 rounded-full bg-brand-blue" />
                                        <p className="text-[10px] font-black text-brand-blue uppercase tracking-widest">Interpretación Pedagógica</p>
                                    </div>
                                    <div className="text-sm font-bold text-brand-gray-700 leading-relaxed whitespace-pre-wrap">
                                        {clinicalExplanation}
                                    </div>
                                    <button 
                                        onClick={() => setClinicalExplanation(null)}
                                        className="mt-4 text-[9px] font-black text-brand-gray-400 uppercase tracking-widest hover:text-brand-gray-600"
                                    >
                                        Cerrar explicación
                                    </button>
                                </div>
                            ) : clinicalExplanationError ? (
                                <div className="bg-brand-soft-red p-6 rounded-2xl animate-fade-in border border-brand-red/10">
                                    <p className="text-sm font-bold text-brand-red leading-relaxed">
                                        {clinicalExplanationError}
                                    </p>
                                    <button
                                        onClick={handleExplainClinical}
                                        disabled={isLoadingClinicalExp}
                                        className="mt-4 px-4 py-2 rounded-xl bg-white text-brand-red border border-brand-red/10 text-[10px] font-black uppercase tracking-widest hover:bg-brand-red hover:text-white transition-all disabled:opacity-50"
                                    >
                                        Intentar de nuevo
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleExplainClinical}
                                    disabled={isLoadingClinicalExp}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-lightblue text-brand-blue border border-brand-blue/10 hover:bg-brand-blue hover:text-white transition-all text-[10px] font-black uppercase tracking-widest active:scale-95 ${isLoadingClinicalExp ? 'opacity-50 cursor-wait' : ''}`}
                                >
                                    <LightBulbIcon className={`w-4 h-4 ${isLoadingClinicalExp ? 'animate-pulse' : ''}`} />
                                    {isLoadingClinicalExp ? 'IA Interpretando...' : 'Explicar mis resultados (IA)'}
                                </button>
                            )}
                        </div>
                    </div>
                </section>
            )}

            {/* ══════════ RISK GAUGES (Radial) ══════════ */}
            <div className="flex justify-between items-center mb-6 ml-2">
                <h2 className="text-[11px] font-black text-brand-gray-400 uppercase tracking-[0.4em]">Predicciones de Riesgo (IA)</h2>
                <button 
                    onClick={() => setShowDebug(!showDebug)} 
                    className={`text-[9px] font-black uppercase tracking-widest hover:underline flex items-center gap-2 ${showDebug ? 'text-brand-orange animate-pulse' : 'text-brand-gray-400'}`}
                >
                    <WrenchIcon className="w-3.5 h-3.5" />
                    {showDebug ? 'Ocultar Valores' : 'Depurar Modelos ML'}
                </button>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-16 relative">
                {!hasRealData && (
                    <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] rounded-[2rem] flex items-center justify-center border border-dashed border-brand-gray-200">
                        <div className="bg-white px-6 py-3 rounded-2xl shadow-premium border border-brand-gray-100 flex items-center gap-3">
                            <InfoCircleIcon className="w-4 h-4 text-brand-blue" />
                            <p className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest text-center">Faltan datos para calcular predicciones</p>
                        </div>
                    </div>
                )}
                {[
                    { label: 'Índice de Vitalidad', value: 100 - predictions.mortality, desc: 'Capacidad de reserva', color: '#10B981', isInverted: true },
                    { label: 'Índice de Protección', value: 100 - predictions.hospitalization, desc: 'Estabilidad clínica', color: '#3B82F6', isInverted: true },
                    { label: 'Salud Cardiovascular', value: 100 - predictions.cvRisk, desc: 'Estado circulatorio', color: '#8B5CF6', isInverted: true },
                    { label: 'Riesgo de Caídas', value: predictions.fallsRisk, desc: 'Probabilidad de caída', color: '#F59E0B', isInverted: false },
                ].map((risk, i) => {
                    let level = '';
                    let levelClass = '';
                    
                    if (risk.isInverted) {
                        // Lógica para ÍNDICES (Subir es BUENO)
                        level = risk.value > 85 ? 'Alto' : risk.value > 70 ? 'Moderado' : 'Bajo';
                        levelClass = risk.value > 85 ? 'text-brand-green bg-brand-soft-green' : risk.value > 70 ? 'text-brand-orange bg-brand-soft-orange' : 'text-brand-red bg-brand-soft-red';
                    } else {
                        // Lógica para RIESGOS (Subir es MALO - Caídas)
                        level = risk.value > 30 ? 'Alto' : risk.value > 15 ? 'Moderado' : 'Bajo';
                        levelClass = risk.value > 30 ? 'text-brand-red bg-brand-soft-red' : risk.value > 15 ? 'text-brand-orange bg-brand-soft-orange' : 'text-brand-green bg-brand-soft-green';
                    }

                    return (
                        <div key={i} className="bg-white p-6 rounded-[2rem] shadow-soft border border-brand-gray-100 flex flex-col items-center text-center hover:shadow-premium transition-all">
                            <div className="relative w-24 h-24 mb-3">
                                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                    <circle cx="50" cy="50" r="42" fill="none" stroke="#F3F4F6" strokeWidth="8" />
                                    <circle cx="50" cy="50" r="42" fill="none" stroke={risk.color} strokeWidth="8"
                                        strokeDasharray={`${risk.value * 2.64} 264`}
                                        strokeLinecap="round" className="transition-all duration-1000" opacity="0.85" />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-2xl font-black text-brand-gray-900">{risk.value.toFixed(0)}%</span>
                                </div>
                            </div>
                            <p className="text-[9px] font-black text-brand-gray-400 uppercase tracking-widest mb-1 min-h-[12px]">{risk.label}</p>
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${levelClass}`}>{level}</span>
                            <p className="text-[10px] text-brand-gray-400 font-bold mt-2 italic">{risk.desc}</p>
                        </div>
                    );
                })}
            </div>

            {showDebug && lastFeatures.length > 0 && (
                <div className="mb-12 bg-brand-gray-900 text-white p-8 rounded-[2rem] shadow-premium-lg animate-slide-up overflow-hidden relative border border-white/10">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <WrenchIcon className="w-24 h-24 rotate-12" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="w-2 h-2 rounded-full bg-brand-orange animate-pulse" />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-orange">Vector de Características (Features)</h3>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                            {[
                                { label: 'Edad', val: lastFeatures[0] },
                                { label: 'Ind. VIGS', val: lastFeatures[1]?.toFixed(2) },
                                { label: 'Albúmina', val: lastFeatures[2] },
                                { label: 'Pantorrilla', val: lastFeatures[3] },
                                { label: 'Hemoglobina', val: lastFeatures[4] },
                                { label: 'PCR', val: lastFeatures[5] },
                                { label: 'Vit. D', val: lastFeatures[6] },
                                { label: 'Creatinina', val: lastFeatures[7] },
                                { label: 'T. Sistólica', val: lastFeatures[8] },
                                { label: 'LDL', val: lastFeatures[9] },
                                { label: 'HbA1c', val: lastFeatures[10] }
                            ].map((f, i) => (
                                <div key={i} className="flex flex-col">
                                    <span className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">{f.label}</span>
                                    <span className="text-xl font-black text-brand-orange tabular-nums leading-none tracking-tighter">{f.val}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <p className="text-[9px] font-medium text-white/40 italic flex items-center gap-2">
                                <InfoCircleIcon className="w-3 h-3" />
                                Modelos Feed-forward utilizando 11 tensores normalizados.
                            </p>
                            <div className="flex gap-4">
                                <button onClick={runPredictions} className="bg-white/10 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white/20 transition-all active:scale-95 shadow-soft">Refrescar Tensores</button>
                                <button onClick={() => setShowDebug(false)} className="bg-brand-orange text-brand-gray-900 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-transform active:scale-95 shadow-premium">Cerrar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════ AI WEEKLY CHALLENGES (GAMIFIED) ══════════ */}
            <section className="mb-16">
                <div className="flex justify-between items-center mb-6 ml-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-yellow/10 rounded-xl">
                            <TrophyIcon className="w-5 h-5 text-brand-yellow" />
                        </div>
                        <h2 className="text-[11px] font-black text-brand-gray-400 uppercase tracking-[0.4em]">Retos Semanales (IA)</h2>
                    </div>
                    <button 
                        onClick={handleFetchChallenges} 
                        disabled={isLoadingChallenges || !hasRealData}
                        className={`px-4 py-2 rounded-full border-2 border-brand-blue text-[10px] font-black uppercase tracking-widest transition-all ${
                            isLoadingChallenges ? 'bg-brand-gray-50 text-brand-gray-400 border-brand-gray-200 cursor-wait' : 
                            !hasRealData ? 'opacity-30 border-brand-gray-300 text-brand-gray-300 cursor-not-allowed' :
                            'bg-white text-brand-blue hover:bg-brand-lightblue active:scale-95'
                        }`}
                    >
                        {isLoadingChallenges ? 'Generando retos...' : (challenges.length > 0 ? 'Renovar Retos' : 'Activar Retos IA')}
                    </button>
                </div>

                {isLoadingChallenges ? (
                    <div className="bg-brand-gray-50 p-10 rounded-[2.5rem] border-2 border-dashed border-brand-gray-200 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                            <TrophyIcon className="w-8 h-8 text-brand-gray-200 animate-pulse" />
                        </div>
                        <h3 className="text-sm font-black text-brand-gray-400 uppercase tracking-widest mb-1">Generando retos...</h3>
                        <p className="text-xs font-bold text-brand-gray-300 max-w-sm">La IA está preparando misiones semanales adaptadas a tus datos de salud.</p>
                    </div>
                ) : challengesError ? (
                    <div className="bg-brand-soft-red p-10 rounded-[2.5rem] border-2 border-brand-red/10 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                            <TrophyIcon className="w-8 h-8 text-brand-red" />
                        </div>
                        <h3 className="text-sm font-black text-brand-red uppercase tracking-widest mb-1">No se pudieron generar los retos IA</h3>
                        <p className="text-xs font-bold text-brand-red/70 max-w-sm">Inténtalo de nuevo.</p>
                    </div>
                ) : challenges.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {challenges.map((challenge) => (
                            <button 
                                key={challenge.id} 
                                onClick={() => handleToggleChallenge(challenge.id)}
                                className={`group relative bg-white p-6 rounded-[2rem] shadow-soft border text-left transition-all duration-300 hover:shadow-premium-lg overflow-hidden ${
                                    challenge.completed ? 'border-brand-green/30 opacity-75 grayscale-[0.5]' : 'border-brand-gray-100'
                                }`}
                            >
                                {challenge.completed && (
                                    <div className="absolute top-0 right-0 p-4 animate-scale-up">
                                        <CheckCircleIcon className="w-8 h-8 text-brand-green" />
                                    </div>
                                )}
                                
                                <div className="flex items-center gap-2 mb-4">
                                    <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                                        challenge.difficulty === 'fácil' ? 'bg-brand-soft-green text-brand-green' :
                                        challenge.difficulty === 'medio' ? 'bg-brand-soft-orange text-brand-orange' :
                                        'bg-brand-soft-red text-brand-red'
                                    }`}>
                                        {challenge.difficulty}
                                    </div>
                                    <div className="px-2 py-0.5 rounded-full bg-brand-gray-100 text-brand-gray-400 text-[8px] font-black uppercase tracking-wider">
                                        {challenge.category}
                                    </div>
                                </div>
                                
                                <h3 className={`text-sm font-black tracking-tight mb-2 ${challenge.completed ? 'text-brand-gray-400 line-through' : 'text-brand-gray-900'}`}>
                                    {challenge.title}
                                </h3>
                                
                                <p className={`text-xs font-bold leading-relaxed mb-6 ${challenge.completed ? 'text-brand-gray-300' : 'text-brand-gray-500'}`}>
                                    {challenge.description}
                                </p>
                                
                                <div className="mt-auto flex justify-between items-center pt-4 border-t border-brand-gray-50">
                                    <div className="flex items-center gap-1.5">
                                        <SparklesIcon className={`w-3.5 h-3.5 ${challenge.completed ? 'text-brand-gray-300' : 'text-brand-blue'}`} />
                                        <span className="text-[10px] font-black text-brand-gray-900">+{challenge.points} XP</span>
                                    </div>
                                    <div className={`text-[9px] font-black uppercase tracking-widest ${challenge.completed ? 'text-brand-green' : 'text-brand-blue'}`}>
                                        {challenge.completed ? 'Completado' : 'Pulsa para completar'}
                                    </div>
                                </div>

                                {challenge.completed && (
                                    <div className="absolute inset-0 bg-brand-green/5 pointer-events-none" />
                                )}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="bg-brand-gray-50 p-10 rounded-[2.5rem] border-2 border-dashed border-brand-gray-200 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                            <TrophyIcon className="w-8 h-8 text-brand-gray-200" />
                        </div>
                        <h3 className="text-sm font-black text-brand-gray-400 uppercase tracking-widest mb-1">Misiones no asignadas</h3>
                        <p className="text-xs font-bold text-brand-gray-300 max-w-sm">Pulsa Activar Retos IA para generarlas.</p>
                    </div>
                )}
            </section>

            {/* AI Summary is now the sole source of personalized feedback above */}


            <h2 className="text-[11px] font-black text-brand-gray-400 uppercase tracking-[0.4em] mb-6 ml-2">Constantes del Diario</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {diaryOptions.filter(opt => diaryPreferences.includes(opt.id as any)).map((opt, i) => {
                    const value = healthData[opt.id as keyof HealthData];
                    const unit = opt.label.match(/\((.*?)\)/)?.[1] || '';
                    const label = opt.label.replace(/\(.*\)/, '').trim();
                    const heightM = (profile?.healthData.height || 170) / 100;
                    const weightMin = Math.round(18.5 * heightM * heightM);
                    const weightMax = Math.round(24.9 * heightM * heightM);

                    const ranges: Record<string, {min: number, max: number}> = {
                        weight: { min: weightMin, max: weightMax },
                        systolicBP: { min: 90, max: 140 },
                        diastolicBP: { min: 60, max: 90 },
                        pulse: { min: 50, max: 100 },
                        glucose: { min: 70, max: 110 },
                        oxygenSaturation: { min: 94, max: 100 }
                    };
                    return (
                        <button 
                            key={opt.id} 
                            onClick={() => handleDetail(label, opt.id, unit, ranges[opt.id])} 
                            className="group bg-white p-6 rounded-v-large shadow-soft border border-brand-gray-100 flex flex-col justify-between h-40 w-full text-left transition-all duration-300 hover:shadow-premium hover:-translate-y-1 active:scale-95"
                        >
                            <h3 className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-[0.15em] leading-none group-hover:text-brand-blue transition-colors">
                                {label}
                            </h3>
                            <div className="flex items-baseline gap-1 mt-auto">
                                <span className="text-4xl font-black text-brand-gray-900 tracking-tighter leading-none group-hover:scale-105 transition-transform origin-left">
                                    {value ?? '--'}
                                </span>
                                <span className="text-[11px] font-extrabold text-brand-blue uppercase tracking-wider">
                                    {unit}
                                </span>
                            </div>
                            
                            {/* Visual Indicator of range if available */}
                            {ranges[opt.id] && value !== null && (
                                <div className="mt-4 flex flex-col gap-1.5 w-full">
                                    <div className="flex justify-between text-[7px] font-black text-brand-gray-400 uppercase tracking-widest px-0.5">
                                        <span>Min {ranges[opt.id].min}</span>
                                        <span>Max {ranges[opt.id].max}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-brand-gray-100 rounded-full overflow-hidden shadow-inner">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${(value as number) > ranges[opt.id].max || (value as number) < ranges[opt.id].min ? 'bg-brand-red' : 'bg-brand-green'}`}
                                            style={{ 
                                                width: `${Math.min(100, Math.max(0, ((value as number) - (ranges[opt.id].min - 20)) / (ranges[opt.id].max - ranges[opt.id].min + 40) * 100))}%` 
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {selectedDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-brand-gray-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-xl rounded-v-xl p-6 sm:p-8 shadow-soft-lg max-h-[90vh] overflow-y-auto relative custom-scrollbar">
                        <div className="sticky top-0 bg-white z-10 flex justify-between items-center mb-6 pt-2 pb-2">
                            <h3 className="text-3xl font-black uppercase tracking-tighter">{selectedDetail.label}</h3>
                            <button onClick={() => setSelectedDetail(null)} className="p-2 bg-brand-gray-100 rounded-full"><XMarkIcon /></button>
                        </div>
                        <HistoryChart data={detailHistory} color="#005A9C" unit={selectedDetail.unit} range={selectedDetail.range} />
                        
                        {selectedDetail.range && detailHistory.length > 0 && (
                            <div className="mt-8 p-6 bg-brand-gray-50 rounded-[2rem] border border-brand-gray-100">
                                <h4 className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <InfoCircleIcon className="w-4 h-4 text-brand-blue" />
                                    Interpretación del Rango
                                </h4>
                                {selectedDetail.key === 'weight' ? (
                                    <div>
                                        {(() => {
                                            const weight = detailHistory[detailHistory.length - 1].value;
                                            const heightM = (profile?.healthData.height || 170) / 100;
                                            const bmi = weight / (heightM * heightM);
                                            let status = "";
                                            let colorClass = "";
                                            if (bmi < 18.5) { status = "Bajo peso"; colorClass = "text-brand-orange"; }
                                            else if (bmi < 25) { status = "Normal"; colorClass = "text-brand-green"; }
                                            else if (bmi < 30) { status = "Sobrepeso"; colorClass = "text-brand-orange"; }
                                            else { status = "Obesidad"; colorClass = "text-brand-red"; }
                                            
                                            return (
                                                <>
                                                    <div className="flex justify-between items-end mb-2">
                                                        <p className="text-sm font-bold text-brand-gray-600">Su IMC actual es:</p>
                                                        <p className="text-3xl font-black text-brand-gray-900 tracking-tighter">{bmi.toFixed(1)} <span className="text-xs text-brand-gray-400 font-black">kg/m²</span></p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-white border ${colorClass}`}>{status}</span>
                                                        <p className="text-xs font-bold text-brand-gray-500 italic">Basado en su altura de {profile?.healthData.height || 170} cm.</p>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                ) : (
                                    <div>
                                        {(() => {
                                            const current = detailHistory[detailHistory.length - 1].value;
                                            const { min, max } = selectedDetail.range;
                                            const isOk = current >= min && current <= max;
                                            return (
                                                <>
                                                    <p className="text-sm font-bold text-brand-gray-600 mb-2">
                                                        Su último registro ({current} {selectedDetail.unit}) está {isOk ? 'dentro' : 'fuera'} del rango recomendado.
                                                    </p>
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-white border ${isOk ? 'text-brand-green' : 'text-brand-red'}`}>
                                                        {isOk ? 'Nivel Óptimo' : 'Nivel a Revisar'}
                                                    </span>
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-8 max-h-48 overflow-y-auto pr-2 space-y-2">
                            {detailHistory.slice().reverse().map((d, i) => (
                                <div key={i} className="flex justify-between p-3 bg-brand-gray-50 rounded-xl">
                                    <span className="text-xs font-bold text-brand-gray-500">{d.date.toLocaleDateString()}</span>
                                    <span className="text-sm font-black text-brand-gray-900">{d.value.toFixed(1)} <span className="text-[10px] text-brand-blue">{selectedDetail.unit}</span></span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {isProfileOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-brand-gray-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-v-xl p-8 shadow-soft-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between mb-8">
                            <h3 className="text-2xl font-black uppercase tracking-tighter">{isEditing ? "Editar Perfil" : "Mi Perfil"}</h3>
                            <button onClick={() => setIsProfileOpen(false)}><XMarkIcon /></button>
                        </div>
                        
                        {!isEditing ? (
                            <div className="flex flex-col items-center">
                                <AvatarComponent className="w-24 h-24 mb-6" />
                                <p className="text-2xl font-black mb-1">{profile?.displayName}</p>
                                <p className="text-brand-gray-400 font-bold text-sm mb-8">{profile?.email}</p>
                                <div className="w-full grid grid-cols-2 gap-3 mb-8">
                                    <div className="p-4 bg-brand-gray-50 rounded-2xl">
                                        <p className="text-[8px] font-black text-brand-gray-400 uppercase tracking-widest mb-1">Edad</p>
                                        <p className="text-xs font-black text-brand-blue">{profile?.age} años</p>
                                    </div>
                                    <div className="p-4 bg-brand-gray-50 rounded-2xl">
                                        <p className="text-[8px] font-black text-brand-gray-400 uppercase tracking-widest mb-1">Tabaquismo</p>
                                        <p className="text-xs font-black text-brand-blue">{profile?.smokingStatus}</p>
                                    </div>
                                </div>

                                <button onClick={() => setIsEditing(true)} className="w-full py-4 bg-brand-lightblue text-brand-blue font-black rounded-xl mb-4 flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest"><PencilSquareIcon className="w-4 h-4"/> Editar Datos Iniciales</button>
                                <button onClick={() => signOut()} className="w-full py-4 text-brand-red font-black text-[10px] uppercase tracking-widest border border-brand-soft-red bg-brand-soft-red rounded-xl">Cerrar Sesión</button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest mb-2 block ml-2">Nombre de Usuario</label>
                                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full p-4 bg-brand-gray-50 border-2 border-brand-gray-100 rounded-xl font-black focus:border-brand-blue outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest mb-2 block ml-2">Edad (Años)</label>
                                    <input type="number" value={editAge} onChange={e => setEditAge(e.target.value)} className="w-full p-4 bg-brand-gray-50 border-2 border-brand-gray-100 rounded-xl font-black focus:border-brand-blue outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest mb-2 block ml-2">Sexo Biológico</label>
                                    <select 
                                        value={editGender} 
                                        onChange={e => setEditGender(e.target.value as any)}
                                        className="w-full p-4 bg-brand-gray-50 border-2 border-brand-gray-100 rounded-xl font-black focus:border-brand-blue outline-none"
                                    >
                                        <option value="male">Hombre</option>
                                        <option value="female">Mujer</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest mb-2 block ml-2">Estado Fumador</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {smokingOptions.map(opt => (
                                            <button key={opt.id} onClick={() => setEditSmoking(opt.id)} className={`p-4 text-left text-[10px] font-black uppercase rounded-xl border-2 transition-all ${editSmoking === opt.id ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-brand-gray-600 border-brand-gray-100'}`}>{opt.label}</button>
                                        ))}
                                    </div>
                                </div>


                                <div>
                                    <label className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest mb-2 block ml-2">Variables del Diario</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {diaryOptions.map(opt => {
                                            const isSelected = editPrefs.includes(opt.id as any);
                                            return (
                                                <button 
                                                    key={opt.id} 
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setEditPrefs(editPrefs.filter(p => p !== opt.id));
                                                        } else {
                                                            setEditPrefs([...editPrefs, opt.id as any]);
                                                        }
                                                    }} 
                                                    className={`p-4 text-left text-[10px] font-black uppercase rounded-xl border-2 transition-all flex justify-between items-center ${isSelected ? 'bg-brand-lightblue text-brand-blue border-brand-blue' : 'bg-white text-brand-gray-600 border-brand-gray-100'}`}
                                                >
                                                    {opt.label}
                                                    {isSelected && <CheckCircleIcon className="w-4 h-4" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button onClick={() => setIsEditing(false)} className="flex-1 py-4 bg-brand-gray-100 text-brand-gray-900 rounded-xl font-black text-xs uppercase tracking-widest">Atrás</button>
                                    <button onClick={handleSaveProfile} className="flex-1 py-4 bg-brand-blue text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-soft">Guardar Todo</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomeScreen;
