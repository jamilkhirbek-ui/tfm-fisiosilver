
type ApiRequest = {
  method?: string;
  body?: any;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: any) => ApiResponse;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, model, isJson, isImage, base64, mimeType, apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'Falta la API Key de Groq' });
  }

  try {
    const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
    
    let messages: any[] = [];
    if (isImage) {
      messages = [{
        role: 'user',
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
        ]
      }];
    } else {
      messages = [{ role: 'user', content: prompt }];
    }

    const body: any = {
      model: model || 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.1
    };

    if (isJson) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(groqUrl, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${apiKey}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
