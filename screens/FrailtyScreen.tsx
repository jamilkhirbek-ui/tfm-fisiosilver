
import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getVigsAssessmentAnswers, getVigsAssessments, saveVigsAssessment, updateUserProfile, updateVigsAssessment } from '../services/dbService';
import { CheckCircleIcon } from '../components/Icons';
import type { VigsAssessmentRecord, VigsScore, VigsCategory } from '../types';

const VIGS_CATEGORIES = {
  FUNCIONAL: {
    title: 'Área Funcional',
    questions: [
      { id: 'dinero', text: '¿Necesita ayuda para gestionar los asuntos económicos (banco, tiendas, restaurantes)?', type: 'binary', points: 1 },
      { id: 'telefono', text: '¿Necesita ayuda para utilizar autónomamente el teléfono?', type: 'binary', points: 1 },
      { id: 'medicacion', text: '¿Necesita ayuda para preparar/administrarse la medicación?', type: 'binary', points: 1 },
      { 
        id: 'barthel', 
        text: 'ABVDs – Índice de Barthel (IB)', 
        type: 'multipleChoice', 
        options: [
          { label: 'No dependencia (IB ≥ 95)', value: 0 },
          { label: 'Dependencia leve-moderada (IB 90–65)', value: 1 },
          { label: 'Dependencia moderada-grave (IB 60–25)', value: 2 },
          { label: 'Dependencia absoluta (IB ≤ 20)', value: 3 },
        ] 
      },
    ]
  },
  NUTRICIONAL: {
    title: 'Área Nutricional',
    questions: [
        { id: 'malnutricion', text: '¿Ha perdido ≥ 5% de peso en los últimos 6 meses?', type: 'binary', points: 1 },
    ]
  },
  COGNITIVO: {
    title: 'Área Cognitiva',
    questions: [
        { 
            id: 'deterioro_cognitivo', 
            text: 'Grado de deterioro cognitivo', 
            type: 'multipleChoice', 
            options: [
              { label: 'Ausencia de deterioro cognitivo', value: 0 },
              { label: 'Deterioro leve-moderado (GDS ≤ 5)', value: 1 },
              { label: 'Deterioro grave-muy grave (GDS ≥ 6)', value: 2 },
            ] 
        },
    ]
  },
  EMOCIONAL: {
      title: 'Área Emocional',
      questions: [
        { id: 'depresion', text: '¿Necesita medicación antidepresiva?', type: 'binary', points: 1 },
        { id: 'ansiedad', text: '¿Necesita benzodiacepinas u otros psicofármacos sedantes habitualmente?', type: 'binary', points: 1 },
      ]
  },
  SOCIAL: {
      title: 'Área Social',
      questions: [
        { id: 'vulnerabilidad', text: '¿Existe percepción profesional de vulnerabilidad social?', type: 'binary', points: 1 },
      ]
  },
  SINDROMES: {
      title: 'Síndromes Geriátricos',
      questions: [
          { id: 'confusional', text: 'En los últimos 6 meses, ¿ha presentado delirium/trastornos del comportamiento que hayan requerido neurolépticos?', type: 'binary', points: 1 },
          { id: 'caidas', text: 'En los últimos 6 meses, ¿≥2 caídas o alguna con ingreso?', type: 'binary', points: 1 },
          { id: 'ulceras', text: '¿Presenta úlcera (por dependencia/vascular) y/o herida crónica?', type: 'binary', points: 1 },
          { id: 'polifarmacia', text: '¿Toma ≥ 5 fármacos habitualmente? (no condicionales)', type: 'binary', points: 1 },
          { id: 'disfagia', text: '¿Se atraganta habitualmente al comer/beber y/o ha tenido infección por broncoaspiración en los últimos 6 meses?', type: 'binary', points: 1 },
      ]
  },
  SINTOMAS: {
      title: 'Síntomas',
      questions: [
        { id: 'dolor', text: '¿Requiere ≥2 analgésicos convencionales y/o opioides mayores para control del dolor?', type: 'binary', points: 1 },
        { id: 'disnea', text: '¿La disnea basal le impide salir de casa y/o requiere opioides habitualmente?', type: 'binary', points: 1 },
      ]
  },
  ENFERMEDADES: {
      title: 'Enfermedades',
      questions: [
        { id: 'cancer', text: '¿Tiene enfermedad oncológica activa?', type: 'triState' },
        { id: 'respiratoria', text: '¿Tiene enfermedad respiratoria crónica (EPOC, neumopatía restrictiva…)?', type: 'triState' },
        { id: 'cardiaca', text: '¿Tiene enfermedad cardíaca crónica (insuficiencia, cardiopatía isquémica, arritmia)?', type: 'triState' },
        { id: 'neurologica', text: '¿Tiene enfermedad neurodegenerativa (Parkinson, ELA…) o antecedente de ictus?', type: 'triState' },
        { id: 'digestiva', text: '¿Tiene enfermedad digestiva crónica (hepatopatía, cirrosis, pancreatitis, EII…)?', type: 'triState' },
        { id: 'renal', text: '¿Tiene insuficiencia renal crónica (FG < 60)?', type: 'triState' },
      ]
  }
};

const getInitialVigsAnswers = (): Record<string, number> => {
    const initialAnswers: Record<string, number> = {};
    Object.values(VIGS_CATEGORIES).forEach(category => {
        category.questions.forEach(q => {
            initialAnswers[q.id] = 0;
        });
    });
    return initialAnswers;
};


const calculateVigsScore = (data: Record<string, number>): VigsScore => {
    const score = Object.values(data).reduce((sum, value) => sum + value, 0);
    const index = score / 25.0;

    let category: VigsCategory;
    
    // Nueva escala basada en IF-VIG decimal
    if (index < 0.20) {
        category = 'No frágil';
    } else if (index <= 0.37) {
        category = 'Fragilidad leve';
    } else if (index <= 0.54) {
        category = 'Fragilidad moderada';
    } else {
        category = 'Fragilidad severa';
    }

    return { score, category, index };
};

const FrailtyScreen: React.FC<{ onGoHome: () => void }> = ({ onGoHome }) => {
    const context = useContext(AppContext);
    const { user } = useAuth();
    const { setVigsScore, setAlerts } = context!;
    
    const [showClinicalWarning, setShowClinicalWarning] = useState(true);
    const [vigsAnswers, setVigsAnswers] = useState<Record<string, number>>(getInitialVigsAnswers);
    const [vigsHistory, setVigsHistory] = useState<VigsAssessmentRecord[]>([]);
    const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isSavingVigs, setIsSavingVigs] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const isEditingVigs = Boolean(editingAssessmentId);

    const loadVigsHistory = async () => {
        if (!user) return;
        setIsLoadingHistory(true);
        try {
            const history = await getVigsAssessments(user.uid);
            setVigsHistory(history);
        } catch (error) {
            console.error('Error loading VIG history:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => {
        void loadVigsHistory();
    }, [user]);

    const handleVigsChange = (id: string, value: number) => {
        setVigsAnswers(prev => ({ ...prev, [id]: value }));
    };

    const handleStartCorrection = async (assessment: VigsAssessmentRecord) => {
        setIsSavingVigs(true);
        setSuccessMessage(null);
        try {
            const previousAnswers = await getVigsAssessmentAnswers(assessment.id);
            setVigsAnswers({ ...getInitialVigsAnswers(), ...previousAnswers });
            setEditingAssessmentId(assessment.id);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            console.error('Error loading VIG answers:', error);
            alert('No se pudieron cargar las respuestas anteriores de esta evaluación.');
        } finally {
            setIsSavingVigs(false);
        }
    };

    const handleCancelCorrection = () => {
        setEditingAssessmentId(null);
        setVigsAnswers(getInitialVigsAnswers());
        setSuccessMessage(null);
    };

    const handleSaveVigs = async () => {
        if (!user) return;
        setIsSavingVigs(true);
        setSuccessMessage(null);
        let newVigs = calculateVigsScore(vigsAnswers);
        
        try {
            if (editingAssessmentId) {
                newVigs = await updateVigsAssessment(editingAssessmentId, user.uid, vigsAnswers);
            } else {
                // Guardar test completo en vigs_assessments
                await saveVigsAssessment(user.uid, vigsAnswers);
            }

            // Actualizar contexto local (puntuación resumen e índice)
            setVigsScore(newVigs);

            const newAlerts = [
                { id: Date.now(), type: 'success' as const, title: isEditingVigs ? 'Cuestionario Corregido' : 'Cuestionario Guardado', message: `Su puntuación VIGS se ha actualizado a ${newVigs.score} (${newVigs.category}). Índice: ${newVigs.index?.toFixed(2)}` },
                ...context!.alerts.filter(a => a.type !== 'success'),
            ];
            setAlerts(newAlerts);

            // Actualizar alertas en perfil de usuario
            await updateUserProfile(user.uid, { alerts: newAlerts });
            await loadVigsHistory();
            setEditingAssessmentId(null);
            
            setSuccessMessage(isEditingVigs ? 'La corrección se ha guardado correctamente.' : 'Los datos se han guardado correctamente.');
            setTimeout(() => setSuccessMessage(null), 3000);

        } catch (error) {
            console.error("Error saving VIGS score:", error);
            alert("Hubo un error al guardar la puntuación. Asegúrese de haber ejecutado el SQL de las tablas VIG.");
        } finally {
            setIsSavingVigs(false);
        }
    };
    
    const BinaryQuestion: React.FC<{ q: { id: string, text: string, points: number, type: 'binary' }, value: number, onChange: (id: string, val: number) => void }> = ({ q, value, onChange }) => (
        <div className="mb-6 p-4 border-l-4 border-brand-gray-200">
            <label className="block text-xl text-brand-gray-700 font-medium mb-3">{q.text}</label>
            <div className="flex space-x-4">
                <button onClick={() => onChange(q.id, q.points)} className={`flex-1 py-3 text-xl font-bold rounded-lg transition-colors ${value === q.points ? 'bg-brand-red text-white' : 'bg-brand-gray-200 text-brand-gray-800'}`}>Sí</button>
                <button onClick={() => onChange(q.id, 0)} className={`flex-1 py-3 text-xl font-bold rounded-lg transition-colors ${value === 0 ? 'bg-brand-green text-white' : 'bg-brand-gray-200 text-brand-gray-800'}`}>No</button>
            </div>
        </div>
    );
    
    const MultipleChoiceQuestion: React.FC<{ q: { id: string, text: string, options: { label: string, value: number }[], type: 'multipleChoice' }, value: number, onChange: (id: string, val: number) => void }> = ({ q, value, onChange }) => (
        <div className="mb-6 p-4 border-l-4 border-brand-gray-200">
            <label className="block text-xl text-brand-gray-700 font-medium mb-3">{q.text}</label>
            <div className="flex flex-col space-y-3">
                {q.options.map(opt => (
                     <button key={opt.value} onClick={() => onChange(q.id, opt.value)} className={`w-full text-left p-4 text-lg font-medium rounded-lg transition-colors ${value === opt.value ? 'bg-brand-blue text-white' : 'bg-brand-lightblue text-brand-blue'}`}>
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );

    const TriStateQuestion: React.FC<{ q: { id: string, text: string, type: 'triState' }, value: number, onChange: (id: string, val: number) => void }> = ({ q, value, onChange }) => (
        <div className="mb-6 p-4 border-l-4 border-brand-gray-200">
            <label className="block text-xl text-brand-gray-700 font-medium mb-3">{q.text}</label>
            <div className="flex space-x-2 md:space-x-4">
                <button onClick={() => onChange(q.id, 0)} className={`flex-1 py-3 text-lg font-bold rounded-lg transition-colors ${value === 0 ? 'bg-brand-green text-white' : 'bg-brand-gray-200 text-brand-gray-800'}`}>No</button>
                <button onClick={() => onChange(q.id, 1)} className={`flex-1 py-3 text-lg font-bold rounded-lg transition-colors ${value === 1 ? 'bg-brand-yellow text-white' : 'bg-brand-gray-200 text-brand-gray-800'}`}>Sí</button>
                <button onClick={() => onChange(q.id, 2)} className={`flex-1 py-3 text-lg font-bold rounded-lg transition-colors ${value === 2 ? 'bg-brand-red text-white' : 'bg-brand-gray-200 text-brand-gray-800'}`}>Sí ++</button>
            </div>
        </div>
    );


    return (
        <div className="p-4 sm:p-6">
            {showClinicalWarning && (
                <div className="fixed inset-0 z-50 bg-brand-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-premium-lg border border-brand-gray-100 max-w-2xl w-full p-8 sm:p-10 animate-scale-up">
                        <div className="w-14 h-14 rounded-2xl bg-brand-lightblue text-brand-blue flex items-center justify-center mb-6">
                            <CheckCircleIcon className="w-7 h-7" />
                        </div>
                        <h2 className="text-3xl font-black text-brand-gray-900 tracking-tight mb-4">
                            Cuestionario clínico de fragilidad
                        </h2>
                        <div className="space-y-4 text-brand-gray-600 text-base sm:text-lg font-medium leading-relaxed">
                            <p>
                                Este cuestionario incluye preguntas clínicas y funcionales que pueden ser difíciles de interpretar sin ayuda profesional, como dependencia, memoria, medicación, enfermedades o síntomas relevantes.
                            </p>
                            <p>
                                Para evitar errores, debe completarse junto a un profesional sanitario. El resultado es orientativo y no sustituye una valoración médica.
                            </p>
                        </div>
                        <div className="mt-8 flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => setShowClinicalWarning(false)}
                                className="flex-1 bg-brand-blue text-white font-black py-4 px-5 rounded-2xl shadow-soft hover:shadow-premium transition-all uppercase tracking-widest text-[11px]"
                            >
                                Estoy con un profesional sanitario
                            </button>
                            <button
                                onClick={onGoHome}
                                className="flex-1 bg-brand-gray-50 text-brand-gray-600 font-black py-4 px-5 rounded-2xl border border-brand-gray-100 hover:bg-brand-soft-red hover:text-brand-red transition-all uppercase tracking-widest text-[11px]"
                            >
                                No estoy con un profesional sanitario
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <header className="mb-8">
                <h1 className="text-4xl font-bold text-brand-gray-800">Cuestionario de Fragilidad</h1>
                <p className="text-xl text-brand-gray-600">Evalúe su nivel de fragilidad con el índice VIGS.</p>
            </header>

            <section className="bg-white p-6 rounded-2xl shadow-md">
                <h2 className="text-2xl font-semibold text-brand-gray-700 mb-6">Cuestionario VIGS (Detallado)</h2>
                {isEditingVigs && (
                    <div className="mb-6 p-4 bg-brand-lightblue text-brand-blue rounded-xl border border-brand-blue/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="font-bold">Modo corrección activo. Está editando una evaluación anterior.</p>
                        <button onClick={handleCancelCorrection} className="px-4 py-2 bg-white rounded-lg font-bold text-sm shadow-sm">
                            Cancelar corrección
                        </button>
                    </div>
                )}
                {Object.values(VIGS_CATEGORIES).map(category => (
                    <div key={category.title} className="mb-8">
                        <h3 className="text-2xl font-bold text-brand-gray-800 p-3 bg-brand-gray-100 rounded-lg mb-4">{category.title}</h3>
                        {category.questions.map(q => {
                           switch(q.type) {
                               case 'binary':
                                   return <BinaryQuestion key={q.id} q={q as any} value={vigsAnswers[q.id]} onChange={handleVigsChange} />;
                               case 'multipleChoice':
                                   return <MultipleChoiceQuestion key={q.id} q={q as any} value={vigsAnswers[q.id]} onChange={handleVigsChange} />;
                                case 'triState':
                                   return <TriStateQuestion key={q.id} q={q as any} value={vigsAnswers[q.id]} onChange={handleVigsChange} />;
                               default:
                                   return null;
                           }
                        })}
                    </div>
                ))}
            </section>
            
            <button
                onClick={handleSaveVigs}
                disabled={isSavingVigs}
                className="w-full mt-8 bg-brand-green text-white text-2xl font-bold py-5 px-6 rounded-2xl shadow-lg hover:bg-green-700 transition-colors disabled:bg-brand-gray-400 disabled:cursor-not-allowed"
            >
                {isSavingVigs ? 'Guardando Cuestionario...' : isEditingVigs ? 'Guardar corrección' : 'Guardar y Calcular Puntuación'}
            </button>
            
             {successMessage && (
                <div className="mt-4 p-4 bg-green-100 text-green-800 rounded-xl border border-green-200 flex items-center justify-center animate-pulse">
                    <CheckCircleIcon />
                    <span className="ml-2 font-bold text-lg">{successMessage}</span>
                </div>
            )}

            <section className="mt-10 bg-white p-6 rounded-2xl shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                    <div>
                        <h2 className="text-2xl font-semibold text-brand-gray-700">Historial VIG</h2>
                        <p className="text-brand-gray-500">Puede corregir una evaluación si detecta un dato introducido por error.</p>
                    </div>
                    {isLoadingHistory && <span className="text-sm font-bold text-brand-gray-400">Cargando...</span>}
                </div>

                {vigsHistory.length === 0 ? (
                    <p className="p-6 bg-brand-gray-50 rounded-xl text-brand-gray-500 font-bold text-center">Todavía no hay evaluaciones VIG registradas.</p>
                ) : (
                    <div className="space-y-3">
                        {vigsHistory.map((assessment) => (
                            <div key={assessment.id} className="p-4 border border-brand-gray-100 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <p className="font-bold text-brand-gray-800">
                                        {assessment.createdAt.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                    <p className="text-sm text-brand-gray-500">
                                        {assessment.score} puntos · Índice {assessment.index.toFixed(2)} · {assessment.category}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleStartCorrection(assessment)}
                                    disabled={isSavingVigs}
                                    className="px-5 py-3 bg-brand-lightblue text-brand-blue rounded-xl font-bold disabled:opacity-50"
                                >
                                    Corregir
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default FrailtyScreen;
