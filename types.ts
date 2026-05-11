
export interface HealthData {
  weight: number | null;
  falls: number | null;
  systolicBP: number | null; // Tensión Alta
  diastolicBP: number | null; // Tensión Baja
  pulse: number | null;
  oxygenSaturation: number | null;
  glucose: number | null;
  calfCircumference: number | null;
  abdominalCircumference: number | null;
  height?: number | null; 
}

export type VigsCategory = 'No frágil' | 'Fragilidad leve' | 'Fragilidad moderada' | 'Fragilidad severa';
export type SmokingStatus = 'Nunca' | 'Ex-fumador' | 'Activo';
export type NutriScore = 'A' | 'B' | 'C' | 'D' | 'E';
export type UserRole = 'patient' | 'admin';

export interface VigsScore {
  score: number;
  category: VigsCategory;
  index?: number; // El valor decimal (0.00 - 1.00)
}

export interface VigsAssessmentRecord {
  id: string;
  userId: string;
  score: number;
  category: VigsCategory;
  index: number;
  createdAt: Date;
}

export interface VigsAssessmentAnswer {
  questionKey: string;
  answerValue: number;
}

export interface Alert {
  id: number;
  type: 'info' | 'warning' | 'success' | 'danger';
  title: string;
  message: string;
  isRecommendation?: boolean;
}

export interface Biomarkers {
    hemoglobin: string;
    albumin: string;
    vitaminD: string;
    glucoseFasting: string;
    egfr: string;
    sodium: string;
    crp: string;
    vitaminB12: string;
    tsh: string;
    creatinine: string;
    ldl: string;
    hba1c: string;
}

export interface ClinicalAnalysisResult {
  summary: string;
  biomarkers: Biomarkers;
  recommendations: string[];
}

export interface NutritionScores {
    protein: number;       // Calidad/cantidad proteica
    fiber: number;         // Aporte de fibra
    healthyFats: number;   // Balance de grasas mono/poliinsaturadas
    micronutrients: number;// Densidad de vitaminas y minerales
    glycemicIndex: number; // Impacto en azúcar en sangre (100 = bajo impacto/bueno)
    sodiumBalance: number; // Control de sal/sodio (100 = bajo sodio/bueno)
}


export interface NutritionalAnalysisResult {
    calories: string;
    nutriScore?: NutriScore;
    nutritionScores: NutritionScores; // Nuevas puntuaciones para el gráfico de araña
    macros: {
        protein: string;
        carbs: string;
        fatsTotal: string;
        fatsSaturated: string;
        fatsUnsaturated: string;
        fatsTrans: string;
        fiber: string;
    };
    micros: {
        calcium: string;
        vitaminD: string;
        vitaminB12: string;
        iron: string;
        sodium: string;
        potassium: string;
    };
    portions: string;
    suggestions: string[];
}

export interface ClinicalAnalysis {
  id: string;
  fileName: string;
  analysis: ClinicalAnalysisResult;
  createdAt: Date;
}

export interface NutritionalAnalysis {
  id: string;
  imagePreview: string;
  analysis: NutritionalAnalysisResult;
  createdAt: Date;
}

export interface DailyLogRecord extends HealthData {
    id: string;
    userId: string;
    createdAt: Date;
    updatedAt?: Date;
}

export interface AdminUserSummary {
    id: string;
    displayName: string;
    email: string;
    role: UserRole;
    active: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    createdBy?: string | null;
    updatedBy?: string | null;
}

export interface UserActionLog {
    id: string;
    userId: string | null;
    actionType: string;
    description?: string | null;
    createdAt: Date;
}
export interface Challenge {
    id: string;
    title: string;
    description: string;
    points: number;
    completed: boolean;
    xpAwarded?: boolean;
    category: 'nutrition' | 'activity' | 'vitals' | 'social';
    difficulty: 'fácil' | 'medio' | 'difícil';
}

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active';

export interface UserProfile {
    email: string;
    displayName: string;
    age: number;
    gender: 'male' | 'female';
    nationality: string;
    language: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    hasLegalConsent: boolean;
    dataProcessingConsent: boolean;
    avatarId: number;
    diaryPreferences: (keyof HealthData)[];
    healthData: HealthData;
    vigsScore: VigsScore;
    alerts: Alert[];
    smokingStatus: SmokingStatus;
    nutritionalScore: number;
    points: number;
    level: number;
    role: UserRole;
    active: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    createdBy?: string | null;
    updatedBy?: string | null;
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
