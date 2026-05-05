import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getAdminUsers, getUserActionLogs, updateAdminUser } from '../services/dbService';
import type { AdminUserSummary, UserActionLog, UserRole } from '../types';

const roleLabels: Record<UserRole, string> = {
    patient: 'Paciente',
    admin: 'Administrador',
};

const AdminScreen: React.FC = () => {
    const { user } = useAuth();
    const { currentProfile } = useContext(AppContext)!;
    const [users, setUsers] = useState<AdminUserSummary[]>([]);
    const [actionLogs, setActionLogs] = useState<UserActionLog[]>([]);
    const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [savingUserId, setSavingUserId] = useState<string | null>(null);

    const loadAdminData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [loadedUsers, loadedLogs] = await Promise.all([
                getAdminUsers(),
                getUserActionLogs(30),
            ]);
            setUsers(loadedUsers);
            setActionLogs(loadedLogs);
        } catch (loadError: any) {
            setError(loadError.message || 'No se ha podido cargar la administracion.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadAdminData();
    }, []);

    const filteredUsers = useMemo(() => {
        if (roleFilter === 'all') return users;
        return users.filter((item) => item.role === roleFilter);
    }, [roleFilter, users]);

    const handleRoleChange = async (targetUserId: string, newRole: UserRole) => {
        if (!user) return;
        setSavingUserId(targetUserId);
        setError(null);
        try {
            await updateAdminUser(targetUserId, user.uid, { role: newRole });
            await loadAdminData();
        } catch (updateError: any) {
            setError(updateError.message || 'No se ha podido actualizar el rol.');
        } finally {
            setSavingUserId(null);
        }
    };

    const handleActiveChange = async (targetUserId: string, active: boolean) => {
        if (!user) return;
        setSavingUserId(targetUserId);
        setError(null);
        try {
            await updateAdminUser(targetUserId, user.uid, { active });
            await loadAdminData();
        } catch (updateError: any) {
            setError(updateError.message || 'No se ha podido actualizar el estado.');
        } finally {
            setSavingUserId(null);
        }
    };

    if (currentProfile?.role !== 'admin') {
        return (
            <div className="p-6 max-w-4xl mx-auto pb-32">
                <div className="bg-white p-10 rounded-3xl border border-brand-gray-100 shadow-soft">
                    <h1 className="text-3xl font-black text-brand-gray-900 tracking-tighter uppercase mb-4">Zona Admin</h1>
                    <p className="text-brand-gray-600 font-medium">
                        Esta pantalla solo esta disponible para usuarios con rol administrador.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto pb-32 animate-fade-in">
            <header className="mb-10 pt-6">
                <p className="text-[10px] font-black text-brand-gray-400 uppercase tracking-[0.25em] mb-3">Administracion</p>
                <h1 className="text-4xl font-black text-brand-gray-900 tracking-tighter uppercase">Panel de Control</h1>
                <p className="text-brand-gray-500 font-medium mt-4 max-w-2xl">
                    Vista simple para revisar usuarios, roles, estado activo y acciones registradas.
                </p>
            </header>

            {error && (
                <div className="mb-6 p-4 bg-brand-soft-red text-brand-red rounded-2xl border border-brand-red/10 font-bold text-sm">
                    {error}
                </div>
            )}

            <section className="bg-white p-6 rounded-3xl border border-brand-gray-100 shadow-soft mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-brand-gray-900 tracking-tight">Usuarios</h2>
                        <p className="text-sm text-brand-gray-500">Filtra visualmente y ajusta rol o estado activo.</p>
                    </div>
                    <select
                        value={roleFilter}
                        onChange={(event) => setRoleFilter(event.target.value as 'all' | UserRole)}
                        className="px-4 py-3 rounded-2xl border border-brand-gray-100 bg-brand-gray-50 font-bold text-sm"
                    >
                        <option value="all">Todos los roles</option>
                        <option value="patient">Solo pacientes</option>
                        <option value="admin">Solo administradores</option>
                    </select>
                </div>

                {isLoading ? (
                    <p className="text-brand-gray-500 font-medium">Cargando usuarios...</p>
                ) : (
                    <div className="space-y-4">
                        {filteredUsers.map((item) => (
                            <div key={item.id} className="border border-brand-gray-100 rounded-2xl p-4 bg-brand-gray-50/60">
                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                    <div>
                                        <p className="text-lg font-black text-brand-gray-900">{item.displayName}</p>
                                        <p className="text-sm text-brand-gray-500">{item.email || 'Sin email'}</p>
                                        <p className="text-xs font-bold text-brand-gray-400 uppercase tracking-widest mt-2">
                                            Creado: {item.createdAt ? item.createdAt.toLocaleDateString('es-ES') : 'Sin fecha'}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:min-w-[380px]">
                                        <label className="flex flex-col gap-2">
                                            <span className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest">Rol</span>
                                            <select
                                                value={item.role}
                                                disabled={savingUserId === item.id}
                                                onChange={(event) => handleRoleChange(item.id, event.target.value as UserRole)}
                                                className="px-4 py-3 rounded-2xl border border-brand-gray-100 bg-white font-bold text-sm"
                                            >
                                                <option value="patient">{roleLabels.patient}</option>
                                                <option value="admin">{roleLabels.admin}</option>
                                            </select>
                                        </label>

                                        <label className="flex flex-col gap-2">
                                            <span className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest">Estado</span>
                                            <select
                                                value={item.active ? 'active' : 'inactive'}
                                                disabled={savingUserId === item.id}
                                                onChange={(event) => handleActiveChange(item.id, event.target.value === 'active')}
                                                className="px-4 py-3 rounded-2xl border border-brand-gray-100 bg-white font-bold text-sm"
                                            >
                                                <option value="active">Activo</option>
                                                <option value="inactive">Inactivo</option>
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {filteredUsers.length === 0 && (
                            <div className="p-6 rounded-2xl bg-brand-gray-50 text-brand-gray-500 font-medium">
                                No hay usuarios para el filtro seleccionado.
                            </div>
                        )}
                    </div>
                )}
            </section>

            <section className="bg-white p-6 rounded-3xl border border-brand-gray-100 shadow-soft">
                <div className="mb-6">
                    <h2 className="text-2xl font-black text-brand-gray-900 tracking-tight">Registro de acciones</h2>
                    <p className="text-sm text-brand-gray-500">Ultimas acciones guardadas en `user_action_log`.</p>
                </div>

                {isLoading ? (
                    <p className="text-brand-gray-500 font-medium">Cargando acciones...</p>
                ) : (
                    <div className="space-y-3">
                        {actionLogs.map((log) => (
                            <div key={log.id} className="border border-brand-gray-100 rounded-2xl p-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <div>
                                        <p className="font-black text-brand-gray-900 uppercase text-sm tracking-wide">{log.actionType}</p>
                                        <p className="text-sm text-brand-gray-600">{log.description || 'Sin descripcion adicional'}</p>
                                        <p className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-widest mt-2">
                                            Usuario: {log.userId || 'Sin usuario'}
                                        </p>
                                    </div>
                                    <p className="text-xs font-bold text-brand-gray-400 uppercase tracking-widest">
                                        {log.createdAt.toLocaleDateString('es-ES')} {log.createdAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {actionLogs.length === 0 && (
                            <div className="p-6 rounded-2xl bg-brand-gray-50 text-brand-gray-500 font-medium">
                                Aun no hay acciones registradas.
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
};

export default AdminScreen;
