
import React from 'react';
import type { NutritionScores } from '../types';

interface NutritionRadarChartProps {
    scores: NutritionScores;
    size?: number;
}

export const NutritionRadarChart: React.FC<NutritionRadarChartProps> = ({ scores, size = 300 }) => {
    const center = size / 2;
    const radius = (size / 2) * 0.7;
    
    // 6 dimensions
    const dimensions = [
        { key: 'protein' as const, label: 'Proteína' },
        { key: 'fiber' as const, label: 'Fibra' },
        { key: 'healthyFats' as const, label: 'Grasas' },
        { key: 'micronutrients' as const, label: 'Micros' },
        { key: 'glycemicIndex' as const, label: 'Azúcar' },
        { key: 'sodiumBalance' as const, label: 'Sal' },
    ];

    const angleStep = (Math.PI * 2) / dimensions.length;

    // Helper to get coordinates
    const getCoords = (index: number, value: number) => {
        const angle = index * angleStep - Math.PI / 2;
        const dist = (value / 100) * radius;
        return {
            x: center + Math.cos(angle) * dist,
            y: center + Math.sin(angle) * dist,
            labelX: center + Math.cos(angle) * (radius + 25),
            labelY: center + Math.sin(angle) * (radius + 25)
        };
    };

    // Build paths
    const points = dimensions.map((d, i) => getCoords(i, scores?.[d.key] || 0));
    const polyPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
    
    // Grid paths
    const gridLevels = [25, 50, 75, 100];

    return (
        <div className="flex items-center justify-center">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
                {/* Background circles */}
                {gridLevels.map(level => (
                    <circle 
                        key={level} 
                        cx={center} cy={center} 
                        r={(level / 100) * radius} 
                        fill="none" 
                        stroke="#E2E8F0" 
                        strokeWidth="1" 
                        strokeDasharray={level === 100 ? "0" : "4 4"}
                    />
                ))}

                {/* Axis lines */}
                {dimensions.map((_, i) => {
                    const p = getCoords(i, 100);
                    return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="#E2E8F0" strokeWidth="1" />;
                })}

                {/* The Radar Polygon */}
                <path 
                    d={polyPath} 
                    fill="rgba(0, 98, 227, 0.2)" 
                    stroke="#0062E3" 
                    strokeWidth="3" 
                    strokeLinejoin="round" 
                    className="transition-all duration-1000 ease-out"
                />

                {/* Labels */}
                {dimensions.map((d, i) => {
                    const p = getCoords(i, 100);
                    return (
                        <text 
                            key={i} 
                            x={p.labelX} 
                            y={p.labelY} 
                            textAnchor="middle" 
                            alignmentBaseline="middle"
                            className="text-[10px] font-black uppercase tracking-widest fill-brand-gray-400"
                        >
                            {d.label}
                        </text>
                    );
                })}

                {/* Data dots */}
                {points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="4" fill="#0062E3" />
                ))}
            </svg>
        </div>
    );
};
