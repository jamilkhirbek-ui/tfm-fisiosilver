// Compatibilidad temporal:
// El proyecto usa Supabase como base de datos. Mantenemos este archivo para no romper
// imports antiguos mientras el servicio real vive en dbService.ts.
export * from './dbService';
