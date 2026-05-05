
/**
 * Utilidades estadísticas para el cálculo de percentiles basados en 
 * Distribución Normal (Campana de Gauss).
 */

/**
 * Calcula la Función de Distribución Acumulada (CDF) para una distribución normal estándar.
 * Esto nos da el percentil (de 0 a 1) para un valor Z dado.
 */
function standardNormalCDF(z: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.821256 + t * 1.3302744))));
    
    if (z > 0) return 1 - p;
    return p;
}

/**
 * Calcula el percentil de un valor dado una media y una desviación estándar.
 * @returns Un número entre 0 y 100 representando el percentil.
 */
export function calculatePercentile(value: number, mean: number, sd: number, invert = false): number {
    if (sd === 0) return 50;
    const z = (value - mean) / sd;
    let percentile = standardNormalCDF(z) * 100;
    
    // Para métricas donde "menos es mejor" (como la tensión o el riesgo), 
    // invertimos el percentil para que un valor bajo sea un percentil alto de salud.
    if (invert) {
        percentile = 100 - percentile;
    }
    
    return Math.round(percentile);
}

/**
 * Estructura de referencia para la población de 1k pacientes.
 * El usuario puede actualizar estos valores con sus datos reales.
 */
export interface MetricReference {
    mean: number;
    sd: number;
    unit: string;
    betterIsLower: boolean; // true si valores bajos son mejores (ej: tensión), false si valores altos son mejores (ej: pantorrilla)
}

export const PopulationReference: Record<string, MetricReference> = {
    systolicBP: {
        mean: 133.673,
        sd: 16.1636,
        unit: 'mmHg',
        betterIsLower: true
    },
    diastolicBP: {
        mean: 78,
        sd: 9,
        unit: 'mmHg',
        betterIsLower: true
    },
    calfCircumference: {
        mean: 31.4322,
        sd: 3.25126,
        unit: 'cm',
        betterIsLower: false
    },
    vigs: {
        mean: 0.31676,
        sd: 0.173976,
        unit: 'VIGS',
        betterIsLower: true
    },
    hemoglobin: {
        mean: 12.3758,
        sd: 1.434145,
        unit: 'g/dL',
        betterIsLower: false
    },
    albumin: {
        mean: 3.81558,
        sd: 0.443682,
        unit: 'g/dL',
        betterIsLower: false
    },
    pcr: {
        mean: 8.05747,
        sd: 4.588993,
        unit: 'mg/L',
        betterIsLower: true
    },
    vitaminD: {
        mean: 22.4246,
        sd: 8.834173,
        unit: 'ng/mL',
        betterIsLower: false
    },
    creatinine: {
        mean: 1.47949,
        sd: 0.33899,
        unit: 'mg/dL',
        betterIsLower: true
    },
    ldl: {
        mean: 109.973,
        sd: 30.196956,
        unit: 'mg/dL',
        betterIsLower: true
    },
    hba1c: {
        mean: 6.0634,
        sd: 0.870217,
        unit: '%',
        betterIsLower: true
    }
};
