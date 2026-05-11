
import React, { useState, useMemo, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppContext } from './contexts/AppContext';
import type { HealthData, VigsScore, Alert, ClinicalAnalysis, NutritionalAnalysis } from './types';
import HomeScreen from './screens/HomeScreen';
import DiaryScreen from './screens/DiaryScreen';
import FrailtyScreen from './screens/FrailtyScreen';
import ClinicalScreen from './screens/ClinicalScreen';
import NutritionScreen from './screens/NutritionScreen';
import VoiceAssistantScreen from './screens/VoiceAssistantScreen';
import AdminScreen from './screens/AdminScreen';
import LoginScreen from './screens/LoginScreen';
import { HomeIcon, BookOpenIcon, ClipboardListIcon, DocumentTextIcon, AppleIcon, MicrophoneIcon, WrenchIcon } from './components/Icons';
import { initializeUser, getClinicalReports, getNutritionLogs } from './services/dbService';
import { canUseAiFeatures } from './services/geminiService';
import { Analytics } from '@vercel/analytics/react';
import type { UserProfile } from './types';

type Tab = 'home' | 'diary' | 'frailty' | 'clinical' | 'nutrition' | 'admin';

const MainApp: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const checkAiStatus = async () => {
      const enabled = await canUseAiFeatures();
      setAiEnabled(enabled);
    };
    checkAiStatus();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
    }
    const enabled = await canUseAiFeatures();
    setAiEnabled(enabled);
  };

  // --- State Initialization ---
  const [healthData, setHealthData] = useState<HealthData>({
    weight: null, falls: null, systolicBP: null, diastolicBP: null, pulse: null, 
    oxygenSaturation: null, glucose: null, calfCircumference: null, abdominalCircumference: null
  });
  
  const [vigsScore, setVigsScore] = useState<VigsScore>({ score: 0, category: 'No frágil' });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [clinicalAnalyses, setClinicalAnalyses] = useState<ClinicalAnalysis[]>([]);
  const [nutritionalAnalyses, setNutritionalAnalyses] = useState<NutritionalAnalysis[]>([]);
  const [diaryPreferences, setDiaryPreferences] = useState<(keyof HealthData)[]>([
    'weight', 'systolicBP', 'diastolicBP', 'pulse', 'oxygenSaturation', 'glucose', 'falls', 'calfCircumference', 'abdominalCircumference'
  ]);
  const [predictions, setPredictions] = useState<{ mortality: number; hospitalization: number; cvRisk: number; fallsRisk: number; lastUpdated?: string }>({ mortality: 0, hospitalization: 0, cvRisk: 0, fallsRisk: 0, lastUpdated: undefined });

  // --- Fetch Data ---
  useEffect(() => {
    const fetchData = async () => {
        if (!user) return;
        
        try {
            setIsLoadingData(true);
            const profile = await initializeUser(user.uid, user.email || '');
            setCurrentProfile(profile);
            setHealthData(profile.healthData);
            setVigsScore(profile.vigsScore);
            setAlerts(profile.alerts || []);
            if (profile.diaryPreferences && profile.diaryPreferences.length > 0) {
                setDiaryPreferences(profile.diaryPreferences);
            }

            const [clinicalDocs, nutritionDocs] = await Promise.all([
                getClinicalReports(user.uid),
                getNutritionLogs(user.uid)
            ]);
            
            setClinicalAnalyses(clinicalDocs);
            setNutritionalAnalyses(nutritionDocs);

        } catch (error: any) {
            console.error("Error fetching data:", error);
            setAlerts([{ id: 999, type: 'danger', title: 'Error de Conexión', message: 'No se pudieron cargar sus datos más recientes.' }]);
        } finally {
            setIsLoadingData(false);
        }
    };

    fetchData();
  }, [user]);

  const appContextValue = useMemo(() => ({
    healthData, setHealthData,
    vigsScore, setVigsScore,
    alerts, setAlerts,
    clinicalAnalyses, setClinicalAnalyses,
    nutritionalAnalyses, setNutritionalAnalyses,
    diaryPreferences, setDiaryPreferences,
    predictions, setPredictions,
    currentProfile, setCurrentProfile,
  }), [healthData, vigsScore, alerts, clinicalAnalyses, nutritionalAnalyses, diaryPreferences, predictions, currentProfile]);

  const renderContent = () => {
    if (isLoadingData) {
        return (
            <div className="flex h-full items-center justify-center bg-brand-bg">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-brand-blue mb-4"></div>
                    <p className="text-brand-gray-600 font-medium">Conectando con su historial...</p>
                </div>
            </div>
        );
    }

    switch (activeTab) {
      case 'home': return <HomeScreen />;
      case 'diary': return <DiaryScreen />;
      case 'frailty': return <FrailtyScreen onGoHome={() => setActiveTab('home')} />;
      case 'clinical': return <ClinicalScreen isAiEnabled={aiEnabled} onConfigureAi={handleOpenKeySelector} />;
      case 'nutrition': return <NutritionScreen isAiEnabled={aiEnabled} onConfigureAi={handleOpenKeySelector} />;
      case 'admin': return <AdminScreen />;
      default: return <HomeScreen />;
    }
  };

  const TabButton = ({ tabName, label, icon }: { tabName: Tab; label: string; icon: React.ReactNode }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`relative flex flex-col items-center justify-center w-full h-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
        activeTab === tabName ? 'text-brand-blue group' : 'text-brand-gray-400 hover:text-brand-blue/60'
      }`}
    >
      <div className={`transition-transform duration-300 ${activeTab === tabName ? 'scale-110 -translate-y-1' : ''}`}>
        {icon}
      </div>
      <span className="mt-1.5">{label}</span>
      {activeTab === tabName && (
        <div className="absolute bottom-2 w-1.5 h-1.5 bg-brand-blue rounded-full shadow-[0_0_8px_rgba(0,98,227,0.5)] animate-fade-in" />
      )}
    </button>
  );

  return (
    <AppContext.Provider value={appContextValue}>
      <div className="flex flex-col h-screen font-sans bg-brand-bg">
        <main className="flex-1 overflow-y-auto pb-32">
          {renderContent()}
        </main>
        
        <footer className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-lg glass-card rounded-v-2xl shadow-premium-lg z-40 px-2 overflow-hidden border border-white/40">
            <nav className="flex justify-around h-20 items-center">
                <TabButton tabName="home" label="Inicio" icon={<HomeIcon />} />
                <TabButton tabName="diary" label="Diario" icon={<BookOpenIcon />} />
                <TabButton tabName="frailty" label="VIGS" icon={<ClipboardListIcon />} />
                <TabButton tabName="clinical" label="Docs" icon={<DocumentTextIcon />} />
                <TabButton tabName="nutrition" label="Nutri" icon={<AppleIcon />} />
                {currentProfile?.role === 'admin' && <TabButton tabName="admin" label="Admin" icon={<WrenchIcon />} />}
            </nav>
        </footer>

        <button
            onClick={() => setIsVoiceAssistantOpen(true)}
            className="fixed bottom-32 right-6 bg-brand-gradient text-white p-5 rounded-full shadow-premium-lg z-30 hover:scale-110 active:scale-95 transition-all duration-300 ring-4 ring-brand-blue/10 animate-pulse-soft"
            aria-label="Abrir asistente de voz"
        >
            <MicrophoneIcon />
        </button>

        {isVoiceAssistantOpen && (
           <div className="fixed inset-0 z-50 bg-brand-bg h-screen animate-fade-in overflow-hidden">
              <VoiceAssistantScreen onClose={() => setIsVoiceAssistantOpen(false)} isAiEnabled={aiEnabled} onConfigureAi={handleOpenKeySelector} />
           </div>
        )}
      </div>
    </AppContext.Provider>
  );
};

const AuthGate: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-brand-bg flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-brand-blue"></div>
            </div>
        );
    }

    if (!user) {
        return <LoginScreen />;
    }

    return <MainApp />;
}

const App: React.FC = () => {
    return (
        <AuthProvider>
            <AuthGate />
            <Analytics />
        </AuthProvider>
    );
};

export default App;
