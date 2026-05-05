
import React, { createContext } from 'react';
import type { HealthData, VigsScore, Alert, ClinicalAnalysis, NutritionalAnalysis, UserProfile } from '../types';

interface AppContextType {
  healthData: HealthData;
  setHealthData: React.Dispatch<React.SetStateAction<HealthData>>;
  vigsScore: VigsScore;
  setVigsScore: React.Dispatch<React.SetStateAction<VigsScore>>;
  alerts: Alert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  clinicalAnalyses: ClinicalAnalysis[];
  setClinicalAnalyses: React.Dispatch<React.SetStateAction<ClinicalAnalysis[]>>;
  nutritionalAnalyses: NutritionalAnalysis[];
  setNutritionalAnalyses: React.Dispatch<React.SetStateAction<NutritionalAnalysis[]>>;
  diaryPreferences: (keyof HealthData)[]; // NEW
  setDiaryPreferences: React.Dispatch<React.SetStateAction<(keyof HealthData)[]>>; // NEW
  predictions: { mortality: number; hospitalization: number; cvRisk: number; fallsRisk: number; lastUpdated?: string };
  setPredictions: React.Dispatch<React.SetStateAction<{ mortality: number; hospitalization: number; cvRisk: number; fallsRisk: number; lastUpdated?: string }>>;
  currentProfile: UserProfile | null;
  setCurrentProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

export const AppContext = createContext<AppContextType | null>(null);
