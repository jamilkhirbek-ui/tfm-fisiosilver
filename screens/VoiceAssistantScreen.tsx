import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { MicrophoneIcon, XMarkIcon } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { AppContext } from '../contexts/AppContext';
import { AI_NOT_CONFIGURED_MESSAGE } from '../services/geminiService';
import { saveDailyLog } from '../services/dbService';

type ConnectionState = 'idle' | 'connecting' | 'listening' | 'processing' | 'error';
type ConversationItem = { speaker: 'system' | 'user'; text: string };
type LiveTokenResponse = { token?: string; model?: string; tokenSetupLocked?: boolean; error?: { message?: string } | string };
type StartMode = 'voice' | 'text';
type LiveAudioBlob = { data: string; mimeType: string };
type FunctionCall = { id?: string; name?: string; args?: Record<string, unknown> };
type RawLiveServerMessage = {
  setupComplete?: unknown;
  serverContent?: {
    inputTranscription?: { text?: string; finished?: boolean };
    outputTranscription?: { text?: string };
    modelTurn?: { parts?: Array<{ text?: string; inlineData?: { data?: string } }> };
    turnComplete?: boolean;
    generationComplete?: boolean;
    interrupted?: boolean;
  };
  toolCall?: { functionCalls?: FunctionCall[] };
};
type RawLiveSession = {
  sendRealtimeInput: (params: { audio?: LiveAudioBlob; audioStreamEnd?: boolean }) => void;
  sendClientContent: (params: { turns?: string; turnComplete?: boolean }) => void;
  sendToolResponse: (params: { functionResponses: unknown }) => void;
  close: () => void;
};
type VoiceDiagnostics = {
  model: string;
  endpoint: string;
  tokenSetupLocked: string;
  wsOpen: boolean;
  setupSent: boolean;
  firstAudioChunkSent: boolean;
  closeCode: string;
  closeReason: string;
  wasClean: string;
  lastMessage: string;
};

const CONNECTION_TIMEOUT_MS = 12000;
const INACTIVITY_TIMEOUT_MS = 120000;
const LIVE_WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';
const LIVE_SYSTEM_INSTRUCTION = 'Eres el asistente de FisioSilver. Responde de forma breve, clara y segura en español. Ayuda al usuario a registrar constantes medicas. Si te preguntan por comida, recuerdale que debe usar la camara en la seccion de Nutricion.';
const INITIAL_DIAGNOSTICS: VoiceDiagnostics = {
  model: 'Pendiente',
  endpoint: 'Pendiente',
  tokenSetupLocked: 'Pendiente',
  wsOpen: false,
  setupSent: false,
  firstAudioChunkSent: false,
  closeCode: '-',
  closeReason: '-',
  wasClean: '-',
  lastMessage: '-',
};

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

function resampleTo16K(data: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return data;
  const ratio = inputSampleRate / 16000;
  const newLength = Math.round(data.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const sourceIndex = i * ratio;
    const before = Math.floor(sourceIndex);
    const after = Math.min(before + 1, data.length - 1);
    const weight = sourceIndex - before;
    result[i] = data[before] * (1 - weight) + data[after] * weight;
  }

  return result;
}

function createAudioBlob(data: Float32Array, inputSampleRate: number): LiveAudioBlob {
  const pcm = resampleTo16K(data, inputSampleRate);
  const int16 = new Int16Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    const sample = Math.max(-1, Math.min(1, pcm[i]));
    int16[i] = sample < 0 ? sample * 32768 : sample * 32767;
  }

  return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
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

const saveHealthDataTool = {
  name: 'saveHealthData',
  description: 'Guarda datos de salud (peso, tension, etc.) en el diario del paciente.',
  parameters: {
    type: 'OBJECT',
    properties: {
      weight: { type: 'NUMBER' },
      systolicBP: { type: 'NUMBER' },
      diastolicBP: { type: 'NUMBER' },
      pulse: { type: 'NUMBER' },
      glucose: { type: 'NUMBER' },
    },
  },
};

const getFriendlyError = (error: unknown) => {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'No se pudo acceder al microfono. Puedes usar el asistente escribiendo.';
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'No se ha encontrado microfono. Puedes usar el asistente escribiendo.';
  }
  return 'No se pudo iniciar el asistente. Intentalo de nuevo o usa el texto.';
};

const logDev = (...args: unknown[]) => {
  if ((import.meta as any).env?.DEV) console.warn('[VoiceAssistant]', ...args);
};

const showVoiceDebug = Boolean((import.meta as any).env?.DEV || (import.meta as any).env?.VITE_SHOW_VOICE_DEBUG === 'true');

const maskToken = (token: string) => `${token.slice(0, 14)}...${token.slice(-6)}`;

const normalizeLiveModel = (model: string) => model.startsWith('models/') ? model : `models/${model}`;

const buildLiveSetupMessage = (mode: StartMode, model: string) => ({
  setup: {
    model,
    generationConfig: {
      responseModalities: [mode === 'voice' ? 'AUDIO' : 'TEXT'],
      ...(mode === 'voice' ? { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } } } : {}),
    },
    systemInstruction: { parts: [{ text: LIVE_SYSTEM_INSTRUCTION }] },
    ...(mode === 'voice' ? {
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      tools: [{ functionDeclarations: [saveHealthDataTool] }],
    } : {}),
  },
});

const parseLiveMessage = async (event: MessageEvent): Promise<RawLiveServerMessage> => {
  if (event.data instanceof Blob) return JSON.parse(await event.data.text());
  if (event.data instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(event.data));
  return JSON.parse(event.data);
};

const createTextTurn = (text: string) => [{
  role: 'user',
  parts: [{ text }],
}];

const buildSafeLiveUrlForLog = (token: string) => `${LIVE_WS_URL}?access_token=${maskToken(token)}`;

const summarizeLiveMessage = (message: RawLiveServerMessage) => {
  if (message.setupComplete) return 'setupComplete';
  if (message.toolCall?.functionCalls?.length) return `toolCall:${message.toolCall.functionCalls.map((fc) => fc.name).join(',')}`;
  if (message.serverContent?.inputTranscription) return `input:${message.serverContent.inputTranscription.text || ''}`.slice(0, 90);
  if (message.serverContent?.outputTranscription) return `output:${message.serverContent.outputTranscription.text || ''}`.slice(0, 90);
  if (message.serverContent?.modelTurn?.parts?.some((part) => part.inlineData?.data)) return 'audio';
  if (message.serverContent?.modelTurn?.parts?.some((part) => part.text)) return `text:${message.serverContent.modelTurn.parts.map((part) => part.text || '').join('')}`.slice(0, 90);
  if (message.serverContent?.turnComplete) return 'turnComplete';
  if (message.serverContent?.generationComplete) return 'generationComplete';
  return Object.keys(message).join(',') || 'mensaje vacio';
};

const createRawSession = (ws: WebSocket, onFirstAudioChunk: () => void): RawLiveSession => {
  const sendJson = (payload: object) => {
    if (ws.readyState !== WebSocket.OPEN) throw new Error('WebSocket no esta abierto');
    ws.send(JSON.stringify(payload));
  };

  return {
    sendRealtimeInput: ({ audio, audioStreamEnd }) => {
      if (audio) onFirstAudioChunk();
      sendJson({ realtimeInput: { ...(audio ? { audio } : {}), ...(audioStreamEnd ? { audioStreamEnd } : {}) } });
    },
    sendClientContent: ({ turns, turnComplete = true }) => {
      sendJson({ clientContent: { turns: turns ? createTextTurn(turns) : [], turnComplete } });
    },
    sendToolResponse: ({ functionResponses }) => {
      sendJson({
        toolResponse: {
          functionResponses: Array.isArray(functionResponses) ? functionResponses : [functionResponses],
        },
      });
    },
    close: () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'client_close');
      }
    },
  };
};

const VoiceAssistantScreen: React.FC<{
  onClose: () => void;
  isAiEnabled: boolean;
  onConfigureAi: () => Promise<void> | void;
}> = ({ onClose, isAiEnabled, onConfigureAi }) => {
  const { user } = useAuth();
  const context = useContext(AppContext)!;
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [conversation, setConversation] = useState<ConversationItem[]>([
    { speaker: 'system', text: 'Pulsa el microfono para iniciar el asistente de voz.' },
  ]);
  const [errorMessage, setErrorMessage] = useState('');
  const [userTranscription, setUserTranscription] = useState('');
  const [assistantPartial, setAssistantPartial] = useState('');
  const [textFallback, setTextFallback] = useState('');
  const [isTextFallbackEnabled, setIsTextFallbackEnabled] = useState(false);
  const [diagnostics, setDiagnostics] = useState<VoiceDiagnostics>(INITIAL_DIAGNOSTICS);

  const sessionRef = useRef<RawLiveSession | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const outputSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef(0);
  const userTranscriptRef = useRef('');
  const assistantTextRef = useRef('');
  const isStartingRef = useRef(false);
  const isMountedRef = useRef(true);
  const intentionalCloseRef = useRef(false);
  const inactivityTimerRef = useRef<number | null>(null);
  const firstAudioChunkSentRef = useRef(false);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const stopOutputPlayback = useCallback(() => {
    outputSourcesRef.current.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // La salida de audio puede haber terminado ya; no debe romper la UI.
      }
    });
    outputSourcesRef.current = [];
    nextStartTimeRef.current = 0;
  }, []);

  const cleanupSession = useCallback(async (nextState?: ConnectionState) => {
    intentionalCloseRef.current = true;
    clearInactivityTimer();
    stopOutputPlayback();

    try {
      sessionRef.current?.sendRealtimeInput?.({ audioStreamEnd: true });
    } catch {
      // La sesion puede estar cerrada; la limpieza debe ser segura.
    }

    try {
      sessionRef.current?.close?.();
    } catch {
      // Evita que un cierre de WebSocket falle fuera del componente.
    }
    sessionRef.current = null;

    try {
      scriptProcessorRef.current?.disconnect();
      scriptProcessorRef.current = null;
      sourceNodeRef.current?.disconnect();
      sourceNodeRef.current = null;
      silentGainRef.current?.disconnect();
      silentGainRef.current = null;
    } catch {
      // Algunos navegadores moviles lanzan errores al desconectar nodos ya cerrados.
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    const inputCtx = inputAudioContextRef.current;
    const outputCtx = outputAudioContextRef.current;
    inputAudioContextRef.current = null;
    outputAudioContextRef.current = null;

    await Promise.allSettled([
      inputCtx && inputCtx.state !== 'closed' ? inputCtx.close() : Promise.resolve(),
      outputCtx && outputCtx.state !== 'closed' ? outputCtx.close() : Promise.resolve(),
    ]);

    userTranscriptRef.current = '';
    assistantTextRef.current = '';
    firstAudioChunkSentRef.current = false;
    if (isMountedRef.current) {
      setUserTranscription('');
      setAssistantPartial('');
      if (nextState) setConnectionState(nextState);
    }
  }, [clearInactivityTimer, stopOutputPlayback]);

  const resetInactivityTimer = useCallback(() => {
    clearInactivityTimer();
    inactivityTimerRef.current = window.setTimeout(() => {
      logDev('Sesion cerrada por inactividad');
      setErrorMessage('Sesion pausada por inactividad. Puedes reintentar.');
      cleanupSession('error');
    }, INACTIVITY_TIMEOUT_MS);
  }, [cleanupSession, clearInactivityTimer]);

  const fetchLiveToken = async (): Promise<{ token: string; model: string; tokenSetupLocked: boolean }> => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);

    try {
      const response = await fetch('/api/gemini-live-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      const data = (await response.json()) as LiveTokenResponse;

      if (!response.ok || !data.token || !data.model) {
        const message = typeof data.error === 'string' ? data.error : data.error?.message;
        throw new Error(message || 'No se pudo crear el token efimero de Gemini Live');
      }

      return { token: data.token, model: data.model, tokenSetupLocked: data.tokenSetupLocked ?? false };
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const connectLiveSession = useCallback(async (mode: StartMode) => {
    const { token, model, tokenSetupLocked } = await fetchLiveToken();
    const normalizedModel = normalizeLiveModel(model);
    const wsUrl = `${LIVE_WS_URL}?access_token=${encodeURIComponent(token)}`;
    const safeEndpoint = buildSafeLiveUrlForLog(token);

    logDev('Token efimero recibido', maskToken(token));
    logDev('Modelo Live usado', normalizedModel);
    logDev('Token con setup bloqueado', tokenSetupLocked);
    logDev('WebSocket Live URL', safeEndpoint);
    setDiagnostics((prev) => ({
      ...prev,
      model: normalizedModel,
      endpoint: safeEndpoint,
      tokenSetupLocked: tokenSetupLocked ? 'Si' : 'No',
    }));

    const session = await new Promise<RawLiveSession>((resolve, reject) => {
      let isSettled = false;
      const setupMessage = buildLiveSetupMessage(mode, normalizedModel);
      const connectionTimeout = window.setTimeout(() => {
        if (isSettled) return;
        isSettled = true;
        logDev('Timeout abriendo WebSocket Live');
        ws.close(4000, 'connection_timeout');
        reject(new Error('Timeout conectando con Gemini Live'));
      }, CONNECTION_TIMEOUT_MS);

      const ws = new WebSocket(wsUrl);
      const rawSession = createRawSession(ws, () => {
        if (!firstAudioChunkSentRef.current) {
          firstAudioChunkSentRef.current = true;
          logDev('Primer chunk de audio enviado');
          setDiagnostics((prev) => ({ ...prev, firstAudioChunkSent: true }));
        }
      });

      ws.onopen = () => {
        window.clearTimeout(connectionTimeout);
        logDev('WebSocket Live open');
        setDiagnostics((prev) => ({ ...prev, wsOpen: true }));
        ws.send(JSON.stringify(setupMessage));
        logDev('Setup Live enviado', { model: normalizedModel, mode });
        setDiagnostics((prev) => ({ ...prev, setupSent: true }));
        if (!isSettled) {
          isSettled = true;
          resolve(rawSession);
        }
      };

      ws.onmessage = async (event) => {
        resetInactivityTimer();
        logDev('Mensaje recibido de Gemini Live');
        let message: RawLiveServerMessage;
        try {
          message = await parseLiveMessage(event);
        } catch (error) {
          logDev('No se pudo parsear mensaje Live', error);
          setDiagnostics((prev) => ({ ...prev, lastMessage: 'No se pudo parsear mensaje' }));
          return;
        }
        setDiagnostics((prev) => ({ ...prev, lastMessage: summarizeLiveMessage(message) }));

        if (message.setupComplete) logDev('Setup Live confirmado por servidor');

        const inputText = message.serverContent?.inputTranscription?.text;
        if (inputText) {
          userTranscriptRef.current = `${userTranscriptRef.current} ${inputText}`.trim();
          setUserTranscription(userTranscriptRef.current);
        }

        if (message.serverContent?.inputTranscription?.finished && userTranscriptRef.current) {
          const finishedText = userTranscriptRef.current;
          setConversation((prev) => [...prev, { speaker: 'user', text: finishedText }]);
          userTranscriptRef.current = '';
          setUserTranscription('');
          setConnectionState('processing');
        }

        const textPart = message.serverContent?.modelTurn?.parts
          ?.map((part) => part.text || '')
          .join('');
        const outputText = message.serverContent?.outputTranscription?.text || textPart;
        if (outputText) {
          assistantTextRef.current = `${assistantTextRef.current}${outputText}`;
          setAssistantPartial(assistantTextRef.current);
        }

        if (message.toolCall?.functionCalls) {
          for (const fc of message.toolCall.functionCalls) {
            if (fc.name === 'saveHealthData' && user) {
              try {
                const merged = { ...context.healthData, ...(fc.args || {}) };
                await saveDailyLog(user.uid, merged);
                context.setHealthData(merged);
                setConversation((prev) => [...prev, { speaker: 'system', text: 'He anotado sus constantes en el diario.' }]);
              } catch (error) {
                logDev('No se pudo guardar desde voz', error);
                setConversation((prev) => [...prev, { speaker: 'system', text: 'No he podido guardar el dato. Puedes revisarlo manualmente en el diario.' }]);
              }
            }

            try {
              sessionRef.current?.sendToolResponse({
                functionResponses: { id: fc.id, name: fc.name, response: { result: 'ok' } },
              });
            } catch (error) {
              logDev('No se pudo responder a la herramienta de Gemini', error);
            }
          }
        }

        const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (audio && outputAudioContextRef.current) {
          try {
            if (outputAudioContextRef.current.state === 'suspended') await outputAudioContextRef.current.resume();
            const buffer = await decodeAudioData(decode(audio), outputAudioContextRef.current, 24000, 1);
            const source = outputAudioContextRef.current.createBufferSource();
            source.buffer = buffer;
            source.connect(outputAudioContextRef.current.destination);
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            outputSourcesRef.current.push(source);
            source.onended = () => {
              outputSourcesRef.current = outputSourcesRef.current.filter((item) => item !== source);
            };
          } catch (error) {
            logDev('No se pudo reproducir audio de Gemini', error);
          }
        }

        if (message.serverContent?.interrupted) stopOutputPlayback();

        if (message.serverContent?.turnComplete || message.serverContent?.generationComplete) {
          if (userTranscriptRef.current) {
            setConversation((prev) => [...prev, { speaker: 'user', text: userTranscriptRef.current }]);
            userTranscriptRef.current = '';
            setUserTranscription('');
          }

          if (assistantTextRef.current.trim()) {
            setConversation((prev) => [...prev, { speaker: 'system', text: assistantTextRef.current.trim() }]);
            assistantTextRef.current = '';
            setAssistantPartial('');
          }

          setConnectionState('listening');
        }
      };

      ws.onerror = (event) => {
        logDev('Error en WebSocket Live', event);
        if (!isSettled) {
          window.clearTimeout(connectionTimeout);
          isSettled = true;
          reject(new Error('Error abriendo WebSocket Live'));
          return;
        }
        setErrorMessage('No se pudo mantener la sesion de voz. Puedes reintentar.');
        cleanupSession('error');
      };

      ws.onclose = (event) => {
        window.clearTimeout(connectionTimeout);
        logDev('WebSocket Live cerrado', { code: event.code, reason: event.reason, wasClean: event.wasClean });
        setDiagnostics((prev) => ({
          ...prev,
          closeCode: String(event.code || '-'),
          closeReason: event.reason || '-',
          wasClean: event.wasClean ? 'Si' : 'No',
        }));
        if (!intentionalCloseRef.current) {
          if (!isSettled) {
            isSettled = true;
            reject(new Error(`WebSocket Live cerrado antes de iniciar: ${event.code} ${event.reason}`.trim()));
            return;
          }
          setErrorMessage('No se pudo iniciar el asistente. Intentalo de nuevo o usa el texto.');
          cleanupSession('error');
        }
      };
    });

    sessionRef.current = session;
  }, [cleanupSession, context, resetInactivityTimer, stopOutputPlayback, user]);

  const startAudioCapture = useCallback(async (stream: MediaStream) => {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) throw new Error('AudioContext no soportado');

    const inputContext = new AudioCtx();
    const outputContext = new AudioCtx({ sampleRate: 24000 });
    inputAudioContextRef.current = inputContext;
    outputAudioContextRef.current = outputContext;

    await inputContext.resume();
    await outputContext.resume();

    const source = inputContext.createMediaStreamSource(stream);
    const scriptProcessor = inputContext.createScriptProcessor(2048, 1, 1);
    const silentGain = inputContext.createGain();
    silentGain.gain.value = 0;

    scriptProcessor.onaudioprocess = (event) => {
      const session = sessionRef.current;
      if (!session) return;
      try {
        session.sendRealtimeInput({ audio: createAudioBlob(event.inputBuffer.getChannelData(0), inputContext.sampleRate) });
      } catch (error) {
        logDev('No se pudo enviar chunk de audio', error);
      }
    };

    source.connect(scriptProcessor);
    scriptProcessor.connect(silentGain);
    silentGain.connect(inputContext.destination);

    sourceNodeRef.current = source;
    scriptProcessorRef.current = scriptProcessor;
    silentGainRef.current = silentGain;
  }, []);

  const startConversation = useCallback(async () => {
    if (!user || isStartingRef.current || sessionRef.current) return;

    setErrorMessage('');
    setAssistantPartial('');
    setIsTextFallbackEnabled(false);
    setDiagnostics(INITIAL_DIAGNOSTICS);
    setConnectionState('connecting');
    isStartingRef.current = true;
    intentionalCloseRef.current = false;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setIsTextFallbackEnabled(true);
        throw new Error('El navegador no soporta acceso al microfono');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      await connectLiveSession('voice');
      await startAudioCapture(stream);
      resetInactivityTimer();
      setConversation((prev) => [...prev, { speaker: 'system', text: 'Fisiosilver activo. Puede hablar cuando quiera.' }]);
      setConnectionState('listening');
    } catch (error) {
      logDev('No se pudo iniciar asistente de voz', error);
      setIsTextFallbackEnabled(true);
      setErrorMessage(getFriendlyError(error));
      await cleanupSession('error');
    } finally {
      isStartingRef.current = false;
    }
  }, [cleanupSession, connectLiveSession, resetInactivityTimer, startAudioCapture, user]);

  const stopConversation = useCallback(async () => {
    await cleanupSession('idle');
    setErrorMessage('');
    setConversation((prev) => [...prev, { speaker: 'system', text: 'Sesión detenida. Puedes volver a iniciar el asistente cuando quieras.' }]);
  }, [cleanupSession]);

  const sendTextMessage = useCallback(async () => {
    const message = textFallback.trim();
    if (!message || isStartingRef.current) return;

    setErrorMessage('');
    setAssistantPartial('');
    setTextFallback('');

    try {
      if (!sessionRef.current) {
        setConnectionState('connecting');
        isStartingRef.current = true;
        intentionalCloseRef.current = false;
        await connectLiveSession('text');
        resetInactivityTimer();
      }

      setConversation((prev) => [...prev, { speaker: 'user', text: message }]);
      setConnectionState('processing');
      sessionRef.current.sendClientContent({ turns: message, turnComplete: true });
    } catch (error) {
      logDev('No se pudo enviar texto al asistente', error);
      setIsTextFallbackEnabled(true);
      setErrorMessage('No se pudo usar el asistente de texto. Puedes reintentar.');
      await cleanupSession('error');
    } finally {
      isStartingRef.current = false;
    }
  }, [cleanupSession, connectLiveSession, resetInactivityTimer, textFallback]);

  const handleClose = useCallback(async () => {
    await cleanupSession();
    onClose();
  }, [cleanupSession, onClose]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanupSession();
    };
  }, [cleanupSession]);

  const isConnecting = connectionState === 'connecting';
  const isActive = connectionState === 'listening' || connectionState === 'processing';
  const statusText = connectionState === 'connecting'
    ? 'Conectando...'
    : connectionState === 'listening'
      ? 'Escuchando...'
      : connectionState === 'processing'
        ? 'Procesando...'
        : connectionState === 'error'
          ? 'No se pudo iniciar'
          : 'Listo para iniciar';

  return (
    <div className="p-6 sm:p-8 flex flex-col h-full bg-brand-bg relative">
      <button onClick={handleClose} className="absolute top-6 right-6 sm:top-8 sm:right-8 p-3 bg-white rounded-full shadow-soft transition-all active:scale-90" aria-label="Cerrar asistente">
        <XMarkIcon />
      </button>

      <header className="mb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-black text-brand-gray-900 tracking-tighter uppercase leading-none">Asistente<br /><span className="text-brand-blue">FISIOSILVER</span></h1>
        <p className="text-brand-gray-500 mt-3 font-bold uppercase tracking-widest text-[10px]">Voz en tiempo real con Gemini</p>
      </header>

      {!isAiEnabled && (
        <div className="mb-4 bg-white border border-brand-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-brand-gray-600 text-sm font-medium leading-relaxed">{AI_NOT_CONFIGURED_MESSAGE}</p>
          <p className="text-brand-gray-400 text-xs font-bold mt-2">El asistente intentara usar el endpoint seguro de Vercel si GEMINI_API_KEY esta configurada.</p>
          <button
            onClick={() => onConfigureAi()}
            className="mt-3 px-4 py-3 rounded-xl bg-brand-blue text-white font-black text-[10px] uppercase tracking-widest"
          >
            Configurar IA
          </button>
        </div>
      )}

      <div className="flex-1 bg-white rounded-v-xl p-5 sm:p-8 overflow-y-auto mb-6 shadow-inner border border-brand-gray-50 space-y-4">
        {conversation.map((item, index) => (
          <div key={`${item.speaker}-${index}`} className={`flex ${item.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-5 rounded-[2rem] shadow-sm ${item.speaker === 'system' ? 'bg-brand-lightblue text-brand-blue font-black' : 'bg-brand-gray-100 text-brand-gray-900 font-bold'}`}>
              <p className="text-sm">{item.text}</p>
            </div>
          </div>
        ))}

        {userTranscription && (
          <div className="flex justify-end opacity-60">
            <div className="max-w-[85%] p-5 rounded-[2rem] bg-brand-gray-50 border border-brand-gray-100 text-brand-gray-900 font-bold italic">
              <p className="text-sm">{userTranscription}...</p>
            </div>
          </div>
        )}

        {assistantPartial && (
          <div className="flex justify-start opacity-80">
            <div className="max-w-[85%] p-5 rounded-[2rem] bg-brand-lightblue text-brand-blue font-black italic">
              <p className="text-sm">{assistantPartial}...</p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="bg-brand-soft-red border border-brand-soft-red rounded-2xl p-4 text-brand-red font-black text-sm">
            <p>{errorMessage}</p>
            {showVoiceDebug && (diagnostics.closeCode !== '-' || diagnostics.closeReason !== '-') && (
              <p className="mt-2 text-[11px] font-bold normal-case tracking-normal text-brand-red/80">
                Codigo: {diagnostics.closeCode} · Motivo: {diagnostics.closeReason}
              </p>
            )}
          </div>
        )}
      </div>

      {showVoiceDebug && (connectionState !== 'idle' || diagnostics.wsOpen || diagnostics.closeCode !== '-') && (
        <div className="mb-5 bg-white/80 rounded-2xl border border-brand-gray-100 p-3 shadow-sm text-[10px] text-brand-gray-500">
          <p className="font-black uppercase tracking-widest text-brand-gray-400 mb-2">Diagnostico Live</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-bold">
            <span>Modelo</span><span className="truncate text-right">{diagnostics.model}</span>
            <span>Endpoint</span><span className="truncate text-right">{diagnostics.endpoint}</span>
            <span>Token setup bloqueado</span><span className="text-right">{diagnostics.tokenSetupLocked}</span>
            <span>WebSocket open</span><span className="text-right">{diagnostics.wsOpen ? 'Si' : 'No'}</span>
            <span>Setup enviado</span><span className="text-right">{diagnostics.setupSent ? 'Si' : 'No'}</span>
            <span>Primer audio</span><span className="text-right">{diagnostics.firstAudioChunkSent ? 'Si' : 'No'}</span>
            <span>Close code</span><span className="text-right">{diagnostics.closeCode}</span>
            <span>Close reason</span><span className="truncate text-right">{diagnostics.closeReason}</span>
            <span>wasClean</span><span className="text-right">{diagnostics.wasClean}</span>
            <span>Ultimo mensaje</span><span className="truncate text-right">{diagnostics.lastMessage}</span>
          </div>
        </div>
      )}

      {(isTextFallbackEnabled || connectionState === 'error' || isActive) && (
        <div className="mb-5 bg-white rounded-2xl border border-brand-gray-100 p-3 shadow-sm">
          <label className="block text-[10px] font-black uppercase tracking-widest text-brand-gray-400 mb-2">Fallback por texto</label>
          <div className="flex gap-2">
            <input
              value={textFallback}
              onChange={(event) => setTextFallback(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') sendTextMessage();
              }}
              placeholder="Escribe si no puedes usar el microfono"
              className="flex-1 bg-brand-gray-50 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-blue/20"
              disabled={isConnecting}
            />
            <button
              onClick={sendTextMessage}
              disabled={isConnecting || !textFallback.trim()}
              className="px-4 py-3 bg-brand-gray-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-40"
            >
              Enviar
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center">
        <button
          onClick={isActive ? stopConversation : startConversation}
          disabled={isConnecting}
          className={`p-9 rounded-full transition-all duration-500 ${isActive ? 'bg-brand-blue text-white shadow-xl scale-105 animate-pulse' : 'bg-brand-gray-200 text-brand-gray-500'} ${isConnecting ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
          aria-label={isActive ? 'Detener asistente de voz' : 'Iniciar asistente de voz'}
        >
          <MicrophoneIcon />
        </button>
        <p className="mt-5 text-[11px] font-black text-brand-gray-400 uppercase tracking-widest">{statusText}</p>
        {isActive && (
          <button onClick={stopConversation} className="mt-3 text-[10px] font-black uppercase tracking-widest text-brand-red">
            Detener
          </button>
        )}
      </div>
    </div>
  );
};

export default VoiceAssistantScreen;
