type ApiRequest = {
  method?: string;
  body?: {
    apiKey?: string;
    model?: string;
    payload?: object;
  };
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: any) => ApiResponse;
};

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = req.body?.apiKey || process.env.GEMINI_API_KEY;
  const model = req.body?.model || 'gemini-2.5-flash';
  const payload = req.body?.payload;

  if (!apiKey) {
    return res.status(400).json({ error: { message: 'Falta la API Key de Gemini', code: 400 } });
  }

  if (!payload) {
    return res.status(400).json({ error: { message: 'Falta el payload de Gemini', code: 400 } });
  }

  try {
    const response = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Error interno de Gemini', code: 500 } });
  }
}
