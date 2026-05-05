import * as ort from 'onnxruntime-web';

// Configuración necesaria para Vite: indica dónde descargar los binarios WebAssembly de ONNX
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
ort.env.logLevel = 'error';
ort.env.debug = false;
ort.env.wasm.numThreads = 1;

const sessionCache: Record<string, ort.InferenceSession> = {};
const sessionInitialization: Record<string, Promise<ort.InferenceSession>> = {};
const executionQueue: Record<string, Promise<any>> = {};

/**
 * Función genérica para ejecutar un modelo ONNX en el navegador con caché de sesión.
 */
export async function runOnnxModel(modelFileName: string, inputData: number[]) {
  // 1. Asegurar que solo una ejecución ocurra a la vez para este modelo específico
  const previousTask = executionQueue[modelFileName] || Promise.resolve();
  
  const task = previousTask.then(async () => {
    try {
      // 2. Cargar el modelo con protección contra condiciones de carrera
      let session = sessionCache[modelFileName];
      
      if (!session) {
          if (!sessionInitialization[modelFileName]) {
              console.log(`Initializing session for: ${modelFileName}`);
              sessionInitialization[modelFileName] = ort.InferenceSession.create(`/Modelos/${modelFileName}`, {
                  executionProviders: ['wasm'],
                  graphOptimizationLevel: 'all'
              });
          }
          session = await sessionInitialization[modelFileName];
          sessionCache[modelFileName] = session;
      }

      // 3. Preparar los datos de entrada (asegurando Float32)
      const floatData = new Float32Array(inputData.map(v => Number(v)));
      const tensor = new ort.Tensor('float32', floatData, [1, inputData.length]);
      const inputName = session.inputNames[0];
      
      // 4. Ejecutar la predicción
      const feeds: Record<string, ort.Tensor> = {};
      feeds[inputName] = tensor;
      
      const results = await session.run(feeds);

      // 5. Extraer resultado
      let outputName = session.outputNames[0];
      if (session.outputNames.length > 1) {
          const probOutput = session.outputNames.find(n => 
              n.toLowerCase().includes('prob') || 
              n.toLowerCase().includes('conf') ||
              n.toLowerCase().includes('score')
          );
          if (probOutput) outputName = probOutput;
      }

      const output = results[outputName];
      
      // Caso: Tensor de [1, 2] (Probabilidades [clase0, clase1])
      if (output.dims && output.dims.length === 2 && Number(output.dims[1]) === 2) {
          return [output.data[1]]; 
      }

      // Caso: Salida que es un objeto/mapa (secuencia de mapas)
      if (Array.isArray(output.data) && typeof output.data[0] === 'object') {
          const firstMap = output.data[0] as Record<string | number, number>;
          const prob = firstMap['1'] ?? firstMap[1] ?? Object.values(firstMap)[1] ?? Object.values(firstMap)[0];
          return [prob];
      }
      
      return output.data;
    } catch (error) {
      console.error(`Error interno en runOnnxModel para ${modelFileName}:`, error);
      throw error;
    }
  });

  executionQueue[modelFileName] = task.catch(() => {}); // Evitar que un error bloquee la cola
  return task;
}

/**
 * Predice el riesgo de mortalidad a 1 año.
 */
export async function predictMortality(features: number[]) {
  const result = await runOnnxModel('modelo_mortalidad-1.onnx', features);
  return result[0] as number;
}

/**
 * Predice el riesgo de hospitalización.
 */
export async function predictHospitalization(features: number[]) {
  const result = await runOnnxModel('modelo_hospitalizacion-1.onnx', features);
  return result[0] as number;
}

/**
 * Predice el riesgo de evento cardiovascular.
 */
export async function predictCVRisk(features: number[]) {
  const result = await runOnnxModel('modelo_evento_cv-1.onnx', features);
  return result[0] as number;
}
