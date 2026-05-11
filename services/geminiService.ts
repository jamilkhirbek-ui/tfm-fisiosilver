import type { Challenge, ClinicalAnalysisResult, NutritionalAnalysisResult, HealthData, VigsScore, UserProfile } from "../types";

// ═══════════════════════════════════════════════════════
// CONFIGURACIÓN DE MODELOS Y LLAVES
// ═══════════════════════════════════════════════════════

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const GROQ_MODEL_TEXT = 'llama-3.1-8b-instant'; // Modelo de bajo consumo y alta velocidad
const GROQ_MODEL_VISION = 'llama-3.2-11b-vision-preview';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

const OPENROUTER_MODEL = 'google/gemma-4-26b-a4b-it:free';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const AI_NOT_CONFIGURED_MESSAGE = 'Funcion de IA no configurada. Puedes seguir usando el registro manual y el cuestionario VIG.';

const hasStaticAiKeys = (): boolean => {
  return [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_SECONDARY,
    process.env.GEMINI_API_KEY_TERTIARY,
    process.env.GEMINI_API_KEY_QUATERNARY,
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_SECONDARY,
    process.env.OPENROUTER_API_KEY,
    process.env.OPENROUTER_API_KEY_SECONDARY,
  ].some(Boolean);
};

export const canUseAiFeatures = async (): Promise<boolean> => {
  if (hasStaticAiKeys()) return true;
  if (typeof window !== 'undefined' && window.aistudio?.hasSelectedApiKey) {
    try {
      return await window.aistudio.hasSelectedApiKey();
    } catch {
      return false;
    }
  }
  return false;
};

/** Cache de claves para evitar recalcular y loguear en cada llamada */
let _geminiKeysCache: string[] | null = null;
let _groqKeysCache: string[] | null = null;

/** Devuelve las claves de Gemini configuradas (cacheadas) */
const getGeminiKeys = (): string[] => {
  if (_geminiKeysCache) return _geminiKeysCache;
  _geminiKeysCache = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_SECONDARY,
    process.env.GEMINI_API_KEY_TERTIARY,
    process.env.GEMINI_API_KEY_QUATERNARY,
  ].filter(Boolean) as string[];
  console.log(`[IA] Claves Gemini disponibles: ${_geminiKeysCache.length}`);
  return _geminiKeysCache;
};

/** Devuelve las claves de Groq configuradas (cacheadas) */
const getGroqKeys = (): string[] => {
  if (_groqKeysCache) return _groqKeysCache;
  _groqKeysCache = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_SECONDARY,
  ].filter(Boolean) as string[];
  console.log(`[IA] Claves Groq disponibles: ${_groqKeysCache.length}`);
  return _groqKeysCache;
};

let _openRouterKeysCache: string[] | null = null;
const getOpenRouterKeys = (): string[] => {
    if (_openRouterKeysCache) return _openRouterKeysCache;
    _openRouterKeysCache = [
        process.env.OPENROUTER_API_KEY,
        process.env.OPENROUTER_API_KEY_SECONDARY,
    ].filter(Boolean) as string[];
    console.log(`[IA] Claves OpenRouter disponibles: ${_openRouterKeysCache.length}`);
    return _openRouterKeysCache;
};
/** Extrae y limpia el JSON de una respuesta de la IA que puede contener texto explicativo */
const cleanJsonResponse = (text: string): string => {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// ═══════════════════════════════════════════════════════
// NÚCLEO GROQ: Llamadas REST con rotación de claves
// ═══════════════════════════════════════════════════════

const callGroqText = async (prompt: string, isJson: boolean = true): Promise<string> => {
  const keys = getGroqKeys();
  if (keys.length === 0) throw new Error("No hay claves de Groq configuradas");

  let lastError: any = null;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const label = `Groq Clave ${i+1}/${keys.length}`;
    try {
      const response = await fetch('/api/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          apiKey: key,
          model: GROQ_MODEL_TEXT,
          isJson
        })
      });

      const data = await response.json();
      if (data.error) {
        console.warn(`[IA] ${label} → Error: ${data.error.message}`);
        lastError = new Error(data.error.message);
        // Continuamos con la siguiente clave ante cualquier error de la API (rate limit, quota, etc.)
        continue;
      }
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("Respuesta vacía de Groq");
      return content;
    } catch (err) {
      console.warn(`[IA] Fallo en ${label}:`, err);
      lastError = err;
      continue;
    }
  }
  throw lastError || new Error("Fallo en todas las claves de Groq");
};

const callGroqWithImage = async (prompt: string, base64: string, mimeType: string): Promise<string> => {
  const keys = getGroqKeys();
  if (keys.length === 0) throw new Error("No hay claves de Groq configuradas");

  for (let key of keys) {
    try {
      const response = await fetch('/api/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          apiKey: key,
          model: GROQ_MODEL_VISION,
          isJson: true,
          isImage: true,
          base64,
          mimeType
        })
      });
      const data = await response.json();
      if (!data.error) return data.choices?.[0]?.message?.content || "";
    } catch (err) { continue; }
  }
  throw new Error("Fallo en Groq Vision");
};

/** Lógica de salvamento final: OpenRouter con rotación de claves */
const callOpenRouter = async (prompt: string, base64?: string, mimeType?: string): Promise<string> => {
    const keys = getOpenRouterKeys();
    if (keys.length === 0) throw new Error("No hay claves de OpenRouter configuradas");
    
    let lastError: any = null;

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        try {
            const messages = base64 ? [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
                    ]
                }
            ] : [{ role: 'user', content: prompt }];

            const response = await fetch(OPENROUTER_BASE_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://fisiosilver.vercel.app',
                    'X-Title': 'Fisiosilver'
                },
                body: JSON.stringify({
                    model: OPENROUTER_MODEL,
                    messages,
                    temperature: 0.1
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                const errMsg = `Status ${response.status}: ${data.error?.message || response.statusText}`;
                console.warn(`[IA] OpenRouter clave ${i+1}/${keys.length} falló:`, errMsg);
                throw new Error(`OpenRouter Error: ${errMsg}`);
            }
            
            return data.choices?.[0]?.message?.content || "";
        } catch (e: any) {
            lastError = e;
            // Si hay otra clave, continuamos en el bucle
            continue;
        }
    }
    
    console.error("[IA] Fallo absoluto en OpenRouter tras rotar claves:", lastError);
    throw lastError;
};

// ═══════════════════════════════════════════════════════
// NÚCLEO GEMINI: Llamada con rotación de claves
// ═══════════════════════════════════════════════════════

const callGemini = async (payload: object): Promise<any> => {
  const keys = getGeminiKeys();
  if (keys.length === 0) throw new Error('No hay claves de Gemini configuradas');

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      // En una version final, el backend/API debe actuar siempre como intermediario
      // entre el frontend y la IA para proteger mejor los datos y las claves.
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: key,
          model: GEMINI_MODEL,
          payload,
        }),
      });

      const data = await response.json();
      if (data.error) {
        const code = data.error.code;
        const msg = data.error.message || '';
        console.warn(`[IA] Gemini clave ${i+1}/${keys.length} → ${code}: ${msg}`);
        // 429 = rate limit, 503 = sobrecarga: esperamos antes de intentar la siguiente clave
        if (code === 429 || code === 503 || msg.includes('demand')) {
          await new Promise(r => setTimeout(r, 2000 * (i + 1))); // backoff progresivo
          continue;
        }
        continue;
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;
      return JSON.parse(cleanJsonResponse(text));
    } catch (err) { continue; }
  }
  throw new Error("Fallo en todas las claves de Gemini");
};

// ═══════════════════════════════════════════════════════
// UTILIDADES DE IMAGEN
// ═══════════════════════════════════════════════════════

const optimizeImage = (file: File): Promise<Blob> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const max = 1600;
        if (width > max || height > max) {
          if (width > height) { height *= max / width; width = max; }
          else { width *= max / height; height = max; }
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.7);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const fileToBase64 = async (file: File): Promise<string> => {
  const blob = await optimizeImage(file);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(blob);
  });
};

const getEffectiveMimeType = (file: File): string => {
  if (file.type === 'application/pdf') return 'application/pdf';
  return file.type.startsWith('image/') ? 'image/jpeg' : file.type;
};

// ═══════════════════════════════════════════════════════
// IMPLEMENTACIÓN DE FUNCIONES DE ANÁLISIS
// ═══════════════════════════════════════════════════════

export const analyzeClinicalReport = async (file: File): Promise<ClinicalAnalysisResult> => {
  const prompt = `Analiza este informe médico para un anciano de forma pedagógica. Responde SOLO JSON: { "summary": "...", "biomarkers": { "hemoglobin": "...", ... }, "recommendations": ["..."] }`;
  const mimeType = getEffectiveMimeType(file);
  const base64 = await fileToBase64(file);
  try { const res = await callOpenRouter(prompt, base64, mimeType); return JSON.parse(cleanJsonResponse(res)); }
  catch { 
      try { return await callGemini({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }] }); }
      catch { const res = await callGroqWithImage(prompt, base64, mimeType); return JSON.parse(cleanJsonResponse(res)); }
  }
};

export const analyzeClinicalText = async (text: string): Promise<ClinicalAnalysisResult> => {
  const prompt = `Analiza este texto médico para un anciano. Responde SOLO JSON con summary, biomarkers y recommendations. TEXTO: ${text}`;
  try {
    console.log("[IA] Análisis texto → OpenRouter (Prioridad 1)...");
    const res = await callOpenRouter(prompt);
    return JSON.parse(cleanJsonResponse(res));
  } catch {
    try {
        console.log("[IA] Análisis texto → Groq (Fallback 1)...");
        const res = await callGroqText(prompt);
        return JSON.parse(cleanJsonResponse(res));
    } catch {
        console.log("[IA] Análisis texto → Gemini (Fallback 2)...");
        return await callGemini({ contents: [{ parts: [{ text: prompt }] }] });
    }
  }
};

export const analyzeFoodPhoto = async (file: File): Promise<NutritionalAnalysisResult> => {
  const prompt = `Analiza esta comida visualmente para un paciente geriátrico.

DEVUELVE ÚNICAMENTE UN OBJETO JSON EXACTAMENTE CON ESTA ESTRUCTURA (SIN texto adicional, SIN markdown):
{
  "calories": "estimación en kcal, ej: 350 kcal",
  "nutriScore": "A, B, C, D o E",
  "nutritionScores": {
    "protein": 80, 
    "fiber": 60,
    "healthyFats": 45,
    "micronutrients": 70,
    "glycemicIndex": 90,
    "sodiumBalance": 50
  },
  "macros": {
    "protein": "valor en g",
    "carbs": "valor en g",
    "fatsTotal": "valor en g"
  },
  "micros": {
    "iron": "...",
    "calcium": "...",
    "vitaminD": "..."
  },
  "portions": "Comentario pedagógico detallado, cálido y médico sobre por qué este plato es bueno o malo para su edad. Evita usar caracteres raros o etiquetas.",
  "suggestions": [
    "Consejo breve 1",
    "Consejo breve 2",
    "Consejo breve 3"
  ]
}
Recuerda: Los valores dentro de 'nutritionScores' deben ser NÚMEROS DEL 0 al 100 estimando su calidad.`;
  const mimeType = getEffectiveMimeType(file);
  const base64 = await fileToBase64(file);
  
  try { 
      console.log("[IA] Análisis nutricional → OpenRouter (Prioridad 1)...");
      const res = await callOpenRouter(prompt, base64, mimeType); 
      return JSON.parse(cleanJsonResponse(res)); 
  } catch (err) { 
      try { 
          console.log("[IA] Análisis nutricional → Gemini (Fallback 1)...", err);
          return await callGemini({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }] }); 
      } catch (geminiErr) { 
          console.log("[IA] Análisis nutricional → Groq (Fallback 2)...", geminiErr);
          const res = await callGroqWithImage(prompt, base64, mimeType); 
          return JSON.parse(cleanJsonResponse(res)); 
      }
  }
};

export const generateWeeklyChallenges = async (healthData: HealthData, vigsScore: VigsScore, profile: UserProfile): Promise<Challenge[]> => {
  const prompt = `Actúa como un geriatra experto. Genera EXACTAMENTE 3 retos semanales para el paciente ${profile.displayName} (${profile.age} años) basándote en:
  - Constantes: ${JSON.stringify(healthData)}
  - Fragilidad (VIGS): ${JSON.stringify(vigsScore)}
  
  INSTRUCCIÓN CRÍTICA: Debes identificar los valores que estén fuera de rango (ej: tensión sistólica > 140, circunferencia pantorrilla < 31, glucosa inestable, etc.). Los retos DEBEN estar directamente enfocados a corregir o mitigar dichos valores específicos. 
  
  Ejemplos:
  - Si tiene tensión alta: Reto de reducir sal o caminar suave.
  - Si tiene bajo peso/poca pantorrilla: Reto de aumentar proteína.
  - Si tiene riesgo de caídas: Reto de ejercicios de equilibrio.
  
  Responde ÚNICAMENTE en JSON:
  { 
    "challenges": [
      { 
        "id": "unique_id", 
        "title": "Reto enfocado en [Problema]", 
        "description": "Explicación médica motivadora", 
        "points": 50, 
        "category": "activity|nutrition|vitals|social", 
        "difficulty": "fácil|medio|difícil",
        "completed": false
      }
    ] 
  }`;

  const parseChallengesResponse = (response: string, provider: string): Challenge[] => {
    const parsed = JSON.parse(cleanJsonResponse(response));
    if (!Array.isArray(parsed.challenges)) {
      console.warn(`[IA] ${provider} devolvió JSON válido sin lista de retos.`);
      return [];
    }
    return parsed.challenges;
  };

  try {
    console.log("[IA] Generando retos semanales → OpenRouter (Prioridad 1)...");
    const res = await callOpenRouter(prompt);
    return parseChallengesResponse(res, "OpenRouter");
  } catch (e) {
    console.warn("[IA] OpenRouter falló generando retos:", e);
    try {
        console.log("[IA] Generando retos semanales → Groq (Fallback 1)...");
        const res = await callGroqText(prompt);
        return parseChallengesResponse(res, "Groq");
    } catch (err) {
        console.warn("[IA] Groq falló generando retos:", err);
        console.log("[IA] Generando retos semanales → Gemini (Fallback 2)...");
        try {
            const res = await callGemini({ contents: [{ parts: [{ text: prompt }] }] });
            const resText = typeof res === 'string' ? res : JSON.stringify(res);
            return parseChallengesResponse(resText, "Gemini");
        } catch (finalErr) {
            console.error("[IA] Fallo crítico generando retos en todos los proveedores:", finalErr);
            throw new Error("No se pudieron generar los retos IA.");
        }
    }
  }
};

// ═══════════════════════════════════════════════════════
// RESUMEN DIARIO DE SALUD (GROQ PRIORITARIO)
// ═══════════════════════════════════════════════════════

export interface DailySummary {
  greeting: string;
  narrative: string;
  analyticsSummary?: string; // Nuevo campo para el resumen de analíticas
  mood: 'great' | 'good' | 'okay' | 'watch';
  highlights: { label: string; status: 'positive' | 'neutral' | 'warning'; detail: string }[];
  quickTip: string;
}

export const generateDailySummary = async (
  profile: UserProfile, healthData: HealthData, vigsScore: VigsScore, recentMeals: string[], latestBiomarkers: Record<string, string> | null
): Promise<DailySummary | null> => {
  const heightM = (profile.healthData?.height || 170) / 100;
  const bmi = healthData.weight ? (healthData.weight / (heightM * heightM)).toFixed(1) : 'N/D';

  const prompt = `
    Eres un médico geriatra cálido y empático. Tu paciente es ${profile.displayName}, de ${profile.age} años.
    DATOS ACTUALES: 
    - Peso: ${healthData.weight ?? 'Sin datos'} kg (IMC: ${bmi})
    - Tensión: ${healthData.systolicBP ?? '---'}/${healthData.diastolicBP ?? '---'} mmHg
    - Pulso: ${healthData.pulse ?? '---'} lpm
    - Azúcar: ${healthData.glucose ?? '---'} mg/dL
    - Fragilidad (VIGS): ${vigsScore.index ?? 'No evaluado'}
    - Analíticas Recientes: ${latestBiomarkers ? JSON.stringify(latestBiomarkers) : 'No hay analíticas registradas aún'}
    - Comidas de hoy: ${recentMeals.length > 0 ? recentMeals.join(', ') : 'No se han registrado comidas todavía'}.

    INSTRUCCIONES:
    1. Greeting: Saludo cariñoso y breve.
    2. Narrative: Resumen de 2-3 frases sobre su estado general actual basándote en los números. Si faltan datos, sé precavido.
    3. AnalyticsSummary: Un resumen muy breve (1 frase) sobre sus analíticas. Si no hay, indica que sería bueno subir una pronto.
    4. Mood: "great", "good", "okay", o "watch".
    5. Highlights: EXACTAMENTE 5 objetos con label ("Hidratación", "Actividad Física", "Descanso", "Nutrición/Salud", "Alimentación Equilibrada"), status ("positive", "neutral", "warning") y un detail breve orientado a motivar.
    6. QuickTip: Un consejo de salud breve y específico.

    RESPONDE ÚNICAMENTE EN FORMATO JSON:
    { 
      "greeting": "...", 
      "narrative": "...", 
      "analyticsSummary": "...",
      "mood": "...", 
      "highlights": [{ "label": "...", "status": "...", "detail": "..." }], 
      "quickTip": "..." 
    }
  `;

  // 1. PRIORIDAD: OPENROUTER
  try {
    console.log("[IA] Solicitando resumen a OpenRouter (Prioridad 1)...");
    const res = await callOpenRouter(prompt);
    const parsed = JSON.parse(cleanJsonResponse(res));
    if (parsed?.highlights) return parsed;
  } catch (err: any) { console.warn("[IA] OpenRouter falló en resumen:", err.message); }

  // 2. FALLBACK 1: GROQ
  try {
    console.log("[IA] Solicitando resumen a Groq (Fallback 1)...");
    const result = await callGroqText(prompt);
    const parsed = JSON.parse(cleanJsonResponse(result));
    if (parsed?.highlights) return parsed;
  } catch (err: any) { console.warn("[IA] Groq falló en resumen:", err.message); }

  // 3. FALLBACK 2: GEMINI
  try {
    console.log("[IA] Solicitando resumen a Gemini (Fallback 2)...");
    return await callGemini({ contents: [{ parts: [{ text: prompt }] }] });
  } catch (err: any) { 
    console.error('[IA] Falló la generación del resumen final en Gemini:', err.message);
  }

  // 3. FALLBACK ESTÁTICO
  return {
    greeting: `Hola, ${profile.displayName}`,
    narrative: 'Los servicios de IA están temporalmente saturados. Tus datos están a salvo.',
    mood: 'okay',
    highlights: [
      { label: 'Hidratación', status: 'neutral', detail: 'Recuerda beber agua con frecuencia.' },
      { label: 'Actividad Física', status: 'neutral', detail: 'Un paseo corto ayuda a tu salud.' },
      { label: 'Descanso', status: 'positive', detail: 'Dormir bien es fundamental.' },
      { label: 'Nutrición/Salud', status: 'neutral', detail: 'Sigue tu dieta recomendada.' },
      { label: 'Alimentación Equilibrada', status: 'neutral', detail: 'Mantén horarios regulares para comer.' },
    ],
    quickTip: 'Pulsa "Actualizar Informe" para intentarlo de nuevo.',
  };
};

export const explainClinicalData = async (clinicalData: any): Promise<string> => {
    const prompt = `Actúa como un médico geriatra con gran capacidad pedagógica. 
    Explica estos valores de una analítica de forma muy sencilla para un paciente mayor: ${JSON.stringify(clinicalData)}.
    
    Estructura tu respuesta en:
    1. Resumen: ¿Cómo está su salud general basándose en esto? (Cercano y amable)
    2. Valores clave: Explica 2 o 3 valores importantes que necesiten atención o estén muy bien.
    3. Acción: Un consejo práctico de estilo de vida para mejorar esos valores.
    
    Usa un lenguaje humano, no técnico. Evita alarmismos. Máximo 150 palabras.`;

    try {
        console.log("[IA] Explicación analítica → OpenRouter (Prioridad 1)...");
        return await callOpenRouter(prompt);
    } catch (e) {
        try {
            console.log("[IA] Explicación analítica → Groq (Fallback)...");
            return await callGroqText(prompt, false);
        } catch (finalErr) {
            console.error("Critical fallback failure:", finalErr);
            return "No se ha podido generar la explicación en este momento (Límite de servicios alcanzado).";
        }
    }
};
