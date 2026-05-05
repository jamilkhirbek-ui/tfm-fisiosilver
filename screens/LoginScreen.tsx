
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { registerUserInDb } from '../services/dbService';
import type { UserProfile, HealthData, SmokingStatus } from '../types';
import { avatars } from '../components/Icons';

const diaryOptions = [
    { id: 'weight', label: 'Peso Corporal' },
    { id: 'systolicBP', label: 'Tensión Sistólica' },
    { id: 'diastolicBP', label: 'Tensión Diastólica' },
    { id: 'pulse', label: 'Pulso (LPM)' },
    { id: 'oxygenSaturation', label: 'Saturación Oxígeno' },
    { id: 'glucose', label: 'Azúcar en Sangre' },
    { id: 'falls', label: 'Control de Caídas' },
    { id: 'calfCircumference', label: 'Pantorrilla' },
    { id: 'abdominalCircumference', label: 'Abdomen' },
];

const smokingOptions: { id: SmokingStatus; label: string }[] = [
    { id: 'Nunca', label: 'Nunca he fumado' },
    { id: 'Ex-fumador', label: 'Soy ex-fumador' },
    { id: 'Activo', label: 'Fumo actualmente' },
];

const LoginScreen: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false); 
  const [step, setStep] = useState(0); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [personalData, setPersonalData] = useState({ displayName: '', edad: '', gender: 'male' as const, height: '' });
  const [diaryFields, setDiaryFields] = useState<(keyof HealthData)[]>(['weight', 'systolicBP', 'diastolicBP', 'pulse', 'glucose']);
  const [legalData, setLegalData] = useState({ hasLegalConsent: false, dataProcessingConsent: false });
  const [avatarId, setAvatarId] = useState(0);
  const [smokingStatus, setSmokingStatus] = useState<SmokingStatus>('Nunca');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
        await signIn(email, password); 
    } catch (err: any) {
        setError(err?.message || "Correo o contraseña no válidos.");
    } finally {
        setLoading(false);
    }
  };

  const inputClass = "w-full p-5 bg-white border border-brand-gray-100 rounded-2xl text-lg font-black text-brand-gray-900 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/5 outline-none transition-all placeholder:text-brand-gray-300";

  const renderStepContent = () => {
      switch(step) {
          case 0: return (
              <div className="space-y-6 animate-slide-up">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-black text-brand-gray-900 tracking-tighter uppercase mb-2">Comencemos</h2>
                    <p className="text-xs font-bold text-brand-gray-400 uppercase tracking-widest">Cree sus claves de acceso seguro</p>
                  </div>
                  <div className="space-y-4">
                    <input type="email" placeholder="Correo electrónico" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} />
                    <input type="password" placeholder="Contraseña (mínimo 6 caracteres)" className={inputClass} value={password} onChange={e => setPassword(e.target.value)} />
                  </div>
              </div>
          );
          case 1: return (
              <div className="space-y-6 animate-slide-up">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-black text-brand-gray-900 tracking-tighter uppercase mb-2">Su Identidad</h2>
                    <p className="text-xs font-bold text-brand-gray-400 uppercase tracking-widest">Para personalizar su experiencia</p>
                  </div>
                  <div>
                      <label className="text-brand-gray-500 font-black block mb-2 uppercase text-[10px] tracking-widest ml-1">Nombre de usuario</label>
                      <input type="text" placeholder="Ej. JuanPerez88" className={inputClass} value={personalData.displayName} onChange={e => setPersonalData({...personalData, displayName: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="text-brand-gray-500 font-black block mb-2 uppercase text-[10px] tracking-widest ml-1">Edad</label>
                          <input type="number" placeholder="Ej. 75" className={inputClass} value={personalData.edad} onChange={e => setPersonalData({...personalData, edad: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-brand-gray-500 font-black block mb-2 uppercase text-[10px] tracking-widest ml-1">Altura (cm)</label>
                          <input type="number" placeholder="Ej. 170" className={inputClass} value={personalData.height} onChange={e => setPersonalData({...personalData, height: e.target.value})} />
                      </div>
                  </div>
                  <div>
                      <label className="text-brand-gray-500 font-black block mb-2 uppercase text-[10px] tracking-widest ml-1">Sexo Biológico</label>
                      <select 
                        className={inputClass} 
                        value={personalData.gender} 
                        onChange={e => setPersonalData({...personalData, gender: e.target.value as any})}
                      >
                          <option value="male">Hombre</option>
                          <option value="female">Mujer</option>
                      </select>
                  </div>
              </div>
          );
          case 2: return (
            <div className="space-y-4 animate-slide-up text-center">
                <div className="mb-8">
                    <h2 className="text-2xl font-black text-brand-gray-900 tracking-tighter uppercase mb-2">Hábito Tabáquico</h2>
                    <p className="text-xs font-bold text-brand-gray-400 uppercase tracking-widest">Importante para calcular riesgos CV</p>
                </div>
                {smokingOptions.map(opt => (
                    <button key={opt.id} onClick={() => setSmokingStatus(opt.id)} className={`w-full text-left p-6 rounded-2xl border-2 transition-all duration-300 ${smokingStatus === opt.id ? 'border-brand-blue bg-brand-lightblue shadow-md' : 'border-brand-gray-100 bg-white hover:border-brand-blue/30'}`}>
                        <span className={`font-black uppercase text-xs tracking-[0.2em] ${smokingStatus === opt.id ? 'text-brand-blue' : 'text-brand-gray-400'}`}>{opt.label}</span>
                    </button>
                ))}
            </div>
          );
          case 3: return (
              <div className="space-y-3 animate-slide-up">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-black text-brand-gray-900 tracking-tighter uppercase mb-2">Su Diario</h2>
                    <p className="text-xs font-bold text-brand-gray-400 uppercase tracking-widest">¿Qué métricas desea anotar hoy?</p>
                  </div>
                  <div className="max-h-[35vh] overflow-y-auto pr-3 space-y-2 custom-scrollbar">
                    {diaryOptions.map(opt => (
                        <button key={opt.id} onClick={() => setDiaryFields(prev => prev.includes(opt.id as any) ? prev.filter(x => x !== opt.id) : [...prev, opt.id as any])} className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-300 ${diaryFields.includes(opt.id as any) ? 'border-brand-blue bg-brand-lightblue' : 'border-brand-gray-50 bg-white'}`}>
                            <span className={`font-black uppercase text-[10px] tracking-widest ${diaryFields.includes(opt.id as any) ? 'text-brand-blue' : 'text-brand-gray-500'}`}>{opt.label}</span>
                        </button>
                    ))}
                  </div>
              </div>
          );
          case 4: return (
              <div className="space-y-6 animate-slide-up">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-black text-brand-gray-900 tracking-tighter uppercase mb-2">Legal</h2>
                    <p className="text-xs font-bold text-brand-gray-400 uppercase tracking-widest">Para proteger su privacidad</p>
                  </div>
                  <label className="flex items-start gap-4 p-6 rounded-2xl bg-brand-gray-50 border border-brand-gray-100 cursor-pointer group transition-all">
                      <input type="checkbox" checked={legalData.hasLegalConsent} onChange={e => setLegalData({...legalData, hasLegalConsent: e.target.checked})} className="mt-1 w-6 h-6 accent-brand-blue rounded-lg" />
                      <span className="text-xs font-bold text-brand-gray-700 uppercase tracking-tight group-hover:text-brand-blue">Acepto los términos y condiciones de uso de Fisiosilver.</span>
                  </label>
                  <label className="flex items-start gap-4 p-6 rounded-2xl bg-brand-gray-50 border border-brand-gray-100 cursor-pointer group transition-all">
                      <input type="checkbox" checked={legalData.dataProcessingConsent} onChange={e => setLegalData({...legalData, dataProcessingConsent: e.target.checked})} className="mt-1 w-6 h-6 accent-brand-blue rounded-lg" />
                      <span className="text-xs font-bold text-brand-gray-700 uppercase tracking-tight group-hover:text-brand-blue">Autorizo el tratamiento de mis datos de salud.</span>
                  </label>
              </div>
          );
          case 5: return (
              <div className="animate-slide-up text-center">
                  <div className="mb-8">
                    <h2 className="text-2xl font-black text-brand-gray-900 tracking-tighter uppercase mb-2">Su Imagen</h2>
                    <p className="text-xs font-bold text-brand-gray-400 uppercase tracking-widest">Elija un avatar para su perfil</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {avatars.map((A, i) => (
                        <button key={i} onClick={() => setAvatarId(i)} className={`p-4 rounded-2xl flex justify-center border-4 transition-all hover:scale-105 active:scale-95 ${avatarId === i ? 'border-brand-blue bg-brand-lightblue shadow-md scale-110' : 'border-transparent bg-brand-gray-50 opacity-60'}`}><A className="w-12 h-12" /></button>
                    ))}
                  </div>
              </div>
          );
          default: return null;
      }
  };

  const handleNext = () => {
      if (step === 0 && (!email || password.length < 6)) { setError("Email válido y contraseña de 6+ caracteres."); return; }
      if (step === 1) {
          if (!personalData.displayName) { setError("Introduzca su nombre de usuario."); return; }
          if (!personalData.edad) { setError("Introduzca su edad."); return; }
          if (!personalData.height) { setError("Introduzca su altura."); return; }
      }
      if (step === 4 && (!legalData.hasLegalConsent || !legalData.dataProcessingConsent)) { setError("Debe aceptar los términos."); return; }
      setError(null);
      setStep(s => s + 1);
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
        const res = await signUp(email, password);
        if (!res) { setError("No se pudo crear la cuenta."); return; }
        await registerUserInDb(res.uid, {
            email,
            displayName: personalData.displayName,
            age: parseInt(personalData.edad) || 75,
            gender: personalData.gender,
            nationality: 'Española',
            language: 'Español',
            emergencyContactName: '',
            emergencyContactPhone: '',
            hasLegalConsent: true,
            dataProcessingConsent: true,
            avatarId,
            diaryPreferences: diaryFields,
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
                height: parseFloat(personalData.height) || 170
            },
            vigsScore: { score: 0, category: 'No frágil' },
            alerts: [],
            smokingStatus,
            nutritionalScore: 0,
            points: 0,
            level: 1,
            role: 'patient',
            active: true,
            createdBy: res.uid,
            updatedBy: res.uid
        });
        setIsRegistering(false);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-brand-blue/5 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 animate-pulse-soft" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2 animate-pulse-soft [animation-delay:1.5s]" />

      <div className="relative bg-white p-10 sm:p-14 rounded-v-xl shadow-premium-lg w-full max-w-lg border border-brand-gray-100 animate-fade-in group">
        <div className="text-center mb-12">
            <div className="w-16 h-1 w-1 bg-brand-blue mx-auto mb-6 rounded-full" />
            <h1 className="text-6xl font-black bg-brand-gradient bg-clip-text text-transparent tracking-tighter uppercase leading-none italic">Fisiosilver</h1>
            <p className="text-brand-gray-400 font-black text-[10px] uppercase tracking-[0.4em] mt-3">Smart Senior Health Assistant</p>
        </div>

        {isRegistering ? (
            <div>
                <div className="flex gap-2 mb-10">
                    {[0,1,2,3,4,5].map(i => <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-700 ${i <= step ? 'bg-brand-blue shadow-[0_0_8px_rgba(0,98,227,0.4)]' : 'bg-brand-gray-100'}`}></div>)}
                </div>
                {renderStepContent()}
                {error && <p className="mt-8 text-brand-red text-center font-bold text-xs bg-brand-soft-red p-5 rounded-2xl animate-fade-in">{error}</p>}
                <div className="mt-12 flex gap-4">
                    {step > 0 && (
                        <button onClick={() => setStep(s => s - 1)} className="flex-1 py-5 bg-brand-gray-50 text-brand-gray-400 hover:text-brand-gray-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">Atrás</button>
                    )}
                    <button 
                        onClick={step === 5 ? handleRegister : handleNext} 
                        disabled={loading} 
                        className="flex-[2] py-5 bg-brand-gradient text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-premium hover:shadow-premium-lg active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        {loading ? 'Procesando...' : (step === 5 ? 'Crear Perfil Médico' : 'Continuar')}
                    </button>
                </div>
            </div>
        ) : (
            <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-4">
                    <div className="relative group/input">
                        <input type="email" placeholder="Correo electrónico" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} required />
                        <div className="absolute inset-0 bg-brand-blue/5 rounded-2xl opacity-0 group-focus-within/input:opacity-100 transition-opacity pointer-events-none" />
                    </div>
                    <div className="relative group/input">
                        <input type="password" placeholder="Contraseña de acceso" className={inputClass} value={password} onChange={e => setPassword(e.target.value)} required />
                        <div className="absolute inset-0 bg-brand-blue/5 rounded-2xl opacity-0 group-focus-within/input:opacity-100 transition-opacity pointer-events-none" />
                    </div>
                </div>
                
                {error && <p className="text-brand-red text-center font-bold text-xs bg-brand-soft-red p-5 rounded-2xl animate-fade-in shadow-sm">{error}</p>}
                
                <button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full py-6 bg-brand-gradient text-white rounded-2xl font-black text-sm uppercase tracking-[0.15em] shadow-premium hover:shadow-premium-lg hover:scale-[1.01] active:scale-95 transition-all duration-300 disabled:opacity-50"
                >
                    {loading ? 'Conectando...' : 'Iniciar Sesión'}
                </button>
                
                <div className="pt-10 border-t border-brand-gray-50 mt-10">
                    <p className="text-center text-[10px] font-bold text-brand-gray-300 uppercase tracking-widest mb-6">¿Eres nuevo en Fisiosilver?</p>
                    <button 
                        type="button" 
                        onClick={() => { setIsRegistering(true); setStep(0); }} 
                        className="w-full py-5 bg-white border-2 border-brand-blue text-brand-blue rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] hover:bg-brand-lightblue transition-all duration-300"
                    >
                        Registrar Nuevo Paciente
                    </button>
                </div>
            </form>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;
