
import React from 'react';

const iconProps = {
  className: "w-6 h-6",
  strokeWidth: 2,
};

export const HomeIcon = () => (
  <svg {...iconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
  </svg>
);

export const BookOpenIcon = () => (
  <svg {...iconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.246.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

export const ClipboardListIcon = () => (
  <svg {...iconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

export const DocumentTextIcon = () => (
  <svg {...iconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

export const AppleIcon = () => (
  <svg {...iconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5a.5.5 0 01.5.5v1.5a.5.5 0 01-1 0V5a.5.5 0 01.5-.5z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6c-4.4 0-6 3.5-6 7 0 4 3 7 6 7s6-3 6-7c0-3.5-1.6-7-6-7z" />
  </svg>
);

export const MicrophoneIcon = () => (
  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5a6 6 0 00-12 0v1.5a6 6 0 006 6z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75a3 3 0 013-3v-1.5a3 3 0 00-6 0v1.5a3 3 0 013 3z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75V21m-3.75-3.75H6a2.25 2.25 0 01-2.25-2.25v-1.5a2.25 2.25 0 012.25-2.25h2.25m6 6h2.25a2.25 2.25 0 002.25-2.25v-1.5a2.25 2.25 0 00-2.25-2.25H15" />
  </svg>
);

export const UploadIcon = () => (
    <svg className="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
);

export const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const XMarkIcon = ({ className }: { className?: string }) => (
  <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export const PencilSquareIcon = ({ className }: { className?: string }) => (
  <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);

export const InfoCircleIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

export const SparklesIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
);

export const LightBulbIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.311a7.5 7.5 0 00-7.5 0c.247.64.72 1.252 1.27 1.765A9.75 9.75 0 0012 21.75a9.75 9.75 0 005.23-1.675c.55-.513 1.023-1.125 1.27-1.765z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

export const HeartIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
);

export const TrashIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

export const UserIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

export const ActivityIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
);

export const PlusIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
    </svg>
);

export const ChevronRightIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
    </svg>
);

export const ArrowPathIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
);

export const TrophyIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.5 18.75h-9m9 0a3 3 0 013-3V13.5M7.5 18.75a3 3 0 00-3-3V13.5m1.5-6h12a1.5 1.5 0 011.5 1.5V13.5a1.5 1.5 0 01-1.5 1.5h-12a1.5 1.5 0 01-1.5-1.5V9a1.5 1.5 0 011.5-1.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3.75v3m6-3v3M12 15v3.75" />
    </svg>
);

export const WrenchIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.867 19.125h.008v.008h-.008v-.008z" />
    </svg>
);

export interface AvatarProps {
  className?: string;
}

// --- Premium Gradient Avatars ---
export const Avatar1 = ({className}: AvatarProps) => (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || "w-12 h-12"}>
        <defs><linearGradient id="a1bg" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse"><stop stopColor="#0062E3"/><stop offset="1" stopColor="#004BB3"/></linearGradient></defs>
        <circle cx="40" cy="40" r="40" fill="url(#a1bg)"/>
        <circle cx="40" cy="30" r="14" fill="#F0F7FF"/>
        <ellipse cx="40" cy="62" rx="22" ry="16" fill="#F0F7FF"/>
        <circle cx="35" cy="28" r="2" fill="#0062E3"/><circle cx="45" cy="28" r="2" fill="#0062E3"/>
        <path d="M36 34 Q40 38 44 34" stroke="#0062E3" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        <rect x="28" y="16" width="24" height="4" rx="2" fill="#004BB3" opacity="0.5"/>
    </svg>
);

export const Avatar2 = ({className}: AvatarProps) => (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || "w-12 h-12"}>
        <defs><linearGradient id="a2bg" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse"><stop stopColor="#10B981"/><stop offset="1" stopColor="#059669"/></linearGradient></defs>
        <circle cx="40" cy="40" r="40" fill="url(#a2bg)"/>
        <circle cx="40" cy="30" r="14" fill="#ECFDF5"/>
        <ellipse cx="40" cy="62" rx="22" ry="16" fill="#ECFDF5"/>
        <circle cx="35" cy="28" r="2" fill="#059669"/><circle cx="45" cy="28" r="2" fill="#059669"/>
        <path d="M36 34 Q40 38 44 34" stroke="#059669" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        <path d="M26 20 Q40 10 54 20" stroke="#059669" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5"/>
    </svg>
);

export const Avatar3 = ({className}: AvatarProps) => (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || "w-12 h-12"}>
        <defs><linearGradient id="a3bg" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse"><stop stopColor="#F59E0B"/><stop offset="1" stopColor="#D97706"/></linearGradient></defs>
        <circle cx="40" cy="40" r="40" fill="url(#a3bg)"/>
        <circle cx="40" cy="30" r="14" fill="#FFFBEB"/>
        <ellipse cx="40" cy="62" rx="22" ry="16" fill="#FFFBEB"/>
        <circle cx="35" cy="28" r="2" fill="#D97706"/><circle cx="45" cy="28" r="2" fill="#D97706"/>
        <path d="M36 34 Q40 38 44 34" stroke="#D97706" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        <circle cx="40" cy="18" r="5" fill="#D97706" opacity="0.4"/><circle cx="40" cy="18" r="3" fill="#FFFBEB" opacity="0.6"/>
    </svg>
);

export const Avatar4 = ({className}: AvatarProps) => (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || "w-12 h-12"}>
        <defs><linearGradient id="a4bg" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse"><stop stopColor="#8B5CF6"/><stop offset="1" stopColor="#6D28D9"/></linearGradient></defs>
        <circle cx="40" cy="40" r="40" fill="url(#a4bg)"/>
        <circle cx="40" cy="30" r="14" fill="#EDE9FE"/>
        <ellipse cx="40" cy="62" rx="22" ry="16" fill="#EDE9FE"/>
        <circle cx="35" cy="28" r="2" fill="#6D28D9"/><circle cx="45" cy="28" r="2" fill="#6D28D9"/>
        <path d="M36 34 Q40 38 44 34" stroke="#6D28D9" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        <rect x="30" y="15" width="20" height="5" rx="2.5" fill="#6D28D9" opacity="0.35"/>
    </svg>
);

export const Avatar5 = ({className}: AvatarProps) => (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || "w-12 h-12"}>
        <defs><linearGradient id="a5bg" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse"><stop stopColor="#EC4899"/><stop offset="1" stopColor="#BE185D"/></linearGradient></defs>
        <circle cx="40" cy="40" r="40" fill="url(#a5bg)"/>
        <circle cx="40" cy="30" r="14" fill="#FCE7F3"/>
        <ellipse cx="40" cy="62" rx="22" ry="16" fill="#FCE7F3"/>
        <circle cx="35" cy="28" r="2" fill="#BE185D"/><circle cx="45" cy="28" r="2" fill="#BE185D"/>
        <path d="M36 34 Q40 38 44 34" stroke="#BE185D" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        <path d="M28 22 Q40 12 52 22" stroke="#BE185D" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.4"/>
        <path d="M30 20 Q40 14 50 20" stroke="#BE185D" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.3"/>
    </svg>
);

export const Avatar6 = ({className}: AvatarProps) => (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || "w-12 h-12"}>
        <defs><linearGradient id="a6bg" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse"><stop stopColor="#6366F1"/><stop offset="1" stopColor="#4338CA"/></linearGradient></defs>
        <circle cx="40" cy="40" r="40" fill="url(#a6bg)"/>
        <circle cx="40" cy="30" r="14" fill="#E0E7FF"/>
        <ellipse cx="40" cy="62" rx="22" ry="16" fill="#E0E7FF"/>
        <circle cx="35" cy="28" r="2" fill="#4338CA"/><circle cx="45" cy="28" r="2" fill="#4338CA"/>
        <path d="M36 34 Q40 38 44 34" stroke="#4338CA" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        <rect x="24" y="16" width="32" height="3" rx="1.5" fill="#4338CA" opacity="0.3"/>
        <rect x="28" y="13" width="24" height="3" rx="1.5" fill="#4338CA" opacity="0.2"/>
    </svg>
);

export const avatars: React.FC<AvatarProps>[] = [Avatar1, Avatar2, Avatar3, Avatar4, Avatar5, Avatar6];
