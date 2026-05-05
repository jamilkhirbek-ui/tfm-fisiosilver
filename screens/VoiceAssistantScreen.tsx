
import React, { useState, useEffect, useRef, useContext } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob, Type, FunctionDeclaration } from "@google/genai";
import { MicrophoneIcon, XMarkIcon, CheckCircleIcon } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { AppContext } from '../contexts/AppContext';
import { AI_NOT_CONFIGURED_MESSAGE } from '../services/geminiService';
import { saveDailyLog } from '../services/dbService';
import type { HealthData } from '../types';

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function encode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
  const int16 = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
  return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
}

const saveHealthDataTool: FunctionDeclaration = {
  name: "saveHealthData",
  description: "Guarda datos de salud (peso, tensión, etc.) en el diario del paciente.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      weight: { type: Type.NUMBER },
      systolicBP: { type: Type.NUMBER },
      diastolicBP: { type: Type.NUMBER },
      pulse: { type: Type.NUMBER },
      glucose: { type: Type.NUMBER },
    },
  }
};

const VoiceAssistantScreen: React.FC<{
  onClose: () => void;
  isAiEnabled: boolean;
  onConfigureAi: () => Promise<void> | void;
}> = ({ onClose, isAiEnabled, onConfigureAi }) => {
    const { user } = useAuth();
    const context = useContext(AppContext)!;
    const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [conversation, setConversation] = useState<{speaker: string, text: string}[]>([]);
    const [userTranscription, setUserTranscription] = useState<string>("");
    
    const sessionRef = useRef<any>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef(0);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

    const startConversation = async () => {
        if (!user) return;
        if (!isAiEnabled) {
            setConnectionState('error');
            return;
        }
        setConnectionState('connecting');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
            inputAudioContextRef.current = new AudioCtx({ sampleRate: 16000 });
            outputAudioContextRef.current = new AudioCtx({ sampleRate: 24000 });
            
            await inputAudioContextRef.current.resume();
            await outputAudioContextRef.current.resume();

            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                callbacks: {
                    onopen: () => {
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;
                        scriptProcessor.onaudioprocess = (e) => {
                            sessionPromise.then(s => s.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) }));
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                        setConnectionState('connected');
                        setConversation([{ speaker: 'system', text: "Fisiosilver activo. ¿Qué medida de salud desea guardar?" }]);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            setUserTranscription(prev => prev + " " + message.serverContent?.inputTranscription?.text);
                        }

                        if (message.serverContent?.turnComplete) {
                            if (userTranscription.trim()) {
                                setConversation(p => [...p, { speaker: 'user', text: userTranscription.trim() }]);
                                setUserTranscription("");
                            }
                        }

                        if (message.toolCall) {
                            for (const fc of message.toolCall.functionCalls) {
                                if (fc.name === 'saveHealthData') {
                                    const merged = { ...context.healthData, ...fc.args };
                                    await saveDailyLog(user.uid, merged);
                                    context.setHealthData(merged);
                                    setConversation(p => [...p, { speaker: 'system', text: "He anotado sus constantes en el diario." }]);
                                }
                                sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "ok" } } }));
                            }
                        }
                        const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audio) {
                            const buffer = await decodeAudioData(decode(audio), outputAudioContextRef.current!, 24000, 1);
                            const source = outputAudioContextRef.current!.createBufferSource();
                            source.buffer = buffer;
                            source.connect(outputAudioContextRef.current!.destination);
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current!.currentTime);
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += buffer.duration;
                        }
                    },
                    onerror: () => setConnectionState('error'),
                    onclose: () => setConnectionState('idle')
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    tools: [{ functionDeclarations: [saveHealthDataTool] }],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
                    systemInstruction: "Eres Fisiosilver, un asistente experto en geriatría. Ayuda al usuario a registrar sus constantes médicas. Si te preguntan por comida, recuérdales que deben usar la cámara en la sección de Nutrición."
                }
            });
            sessionRef.current = await sessionPromise;
        } catch (e) { setConnectionState('error'); }
    };

    useEffect(() => {
        if (isAiEnabled) {
            startConversation();
        }
        return () => { sessionRef.current?.close(); };
    }, [isAiEnabled]);

    if (!isAiEnabled) {
        return (
            <div className="p-8 flex flex-col h-full bg-brand-bg relative">
                <button onClick={onClose} className="absolute top-8 right-8 p-3 bg-white rounded-full shadow-soft transition-all active:scale-90"><XMarkIcon /></button>
                <div className="m-auto max-w-xl w-full bg-white rounded-v-xl p-10 shadow-soft border border-brand-gray-100 text-center">
                    <h1 className="text-4xl font-black text-brand-gray-900 tracking-tighter uppercase leading-none mb-6">Asistente de Voz</h1>
                    <p className="text-brand-gray-600 font-medium leading-relaxed">{AI_NOT_CONFIGURED_MESSAGE}</p>
                    <button
                        onClick={() => onConfigureAi()}
                        className="mt-8 px-6 py-4 rounded-2xl bg-brand-blue text-white font-black text-[10px] uppercase tracking-widest"
                    >
                        Configurar IA
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 flex flex-col h-full bg-brand-bg relative">
            <button onClick={onClose} className="absolute top-8 right-8 p-3 bg-white rounded-full shadow-soft transition-all active:scale-90"><XMarkIcon /></button>
            <header className="mb-12 text-center">
                <h1 className="text-4xl font-black text-brand-gray-900 tracking-tighter uppercase leading-none">Asistente<br/><span className="text-brand-blue">FISIOSILVER</span></h1>
                <p className="text-brand-gray-500 mt-3 font-bold uppercase tracking-widest text-[10px]">Hable con total libertad</p>
            </header>
            
            <div className="flex-1 bg-white rounded-v-xl p-8 overflow-y-auto mb-8 shadow-inner border border-brand-gray-50 space-y-4">
                {connectionState === 'connecting' && <p className="text-center text-brand-gray-400 font-black uppercase text-[10px] animate-pulse">Iniciando...</p>}
                {conversation.map((t, i) => (
                    <div key={i} className={`flex ${t.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-5 rounded-[2rem] shadow-sm ${t.speaker === 'system' ? 'bg-brand-lightblue text-brand-blue font-black' : 'bg-brand-gray-100 text-brand-gray-900 font-bold'}`}>
                            <p className="text-sm">{t.text}</p>
                        </div>
                    </div>
                ))}
                {userTranscription && (
                    <div className="flex justify-end opacity-50">
                        <div className="max-w-[85%] p-5 rounded-[2rem] bg-brand-gray-50 border border-brand-gray-100 text-brand-gray-900 font-bold italic">
                            <p className="text-sm">{userTranscription}...</p>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="flex flex-col items-center">
                <div className={`p-10 rounded-full transition-all duration-500 ${connectionState === 'connected' ? 'bg-brand-blue text-white shadow-xl scale-110 animate-pulse' : 'bg-brand-gray-200 text-brand-gray-400 opacity-50'}`}>
                    <MicrophoneIcon />
                </div>
                <p className="mt-6 text-[11px] font-black text-brand-gray-400 uppercase tracking-widest">
                    {connectionState === 'connected' ? 'Escuchando...' : 'Conectando...'}
                </p>
            </div>
        </div>
    );
};

export default VoiceAssistantScreen;
