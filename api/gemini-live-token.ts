import { GoogleGenAI } from '@google/genai';

type ApiRequest = {
  method?: string;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: any) => ApiResponse;
};

const DEFAULT_GEMINI_LIVE_MODEL = 'gemini-3.1-flash-live-preview';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_LIVE_MODEL || DEFAULT_GEMINI_LIVE_MODEL;

  if (!apiKey) {
    return res.status(500).json({ error: { message: 'GEMINI_API_KEY no configurada en el servidor', code: 500 } });
  }

  try {
    const client = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });
    const expireTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString();

    // El frontend solo recibe un token corto; la clave real queda en Vercel.
    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        liveConnectConstraints: { model },
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });

    if (!token.name) {
      return res.status(500).json({ error: { message: 'Gemini no devolvio token efimero', code: 500 } });
    }

    return res.status(200).json({ token: token.name, model, expireTime });
  } catch (error: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Gemini Live Token]', error);
    }
    return res.status(500).json({ error: { message: 'No se pudo crear token efimero de Gemini Live', code: 500 } });
  }
}
