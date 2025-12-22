// api/generate.js
export const config = {
  runtime: 'edge', // This makes it super fast (No lag)
};

export default async function handler(req) {
  // 1. Check if the request is a POST method
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    // 2. Get the user's message from the frontend
    const { message } = await req.json();

    // 3. Prepare the secure call to Gemini
    const apiKey = process.env.GEMINI_API_KEY; // The key lives securely here
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ parts: [{ text: message }] }]
    };

    // 4. Call Google Gemini (Server to Server)
    const geminiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await geminiResponse.json();

    // 5. Send the clean answer back to your app
    const answer = data.candidates[0].content.parts[0].text;
    return new Response(JSON.stringify({ reply: answer }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error processing request' }), { status: 500 });
  }
}
