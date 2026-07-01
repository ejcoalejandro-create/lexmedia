export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { url } = req.body;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "es-ES,es;q=0.9",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await response.text();
    console.log("fetch-url bytes:", text.length);
    res.status(200).json({ contents: text });
  } catch (e) {
    console.error("fetch-url error:", e.message);
    // Si falla devuelve vacío para que Claude use solo la URL
    res.status(200).json({ contents: "", error: e.message });
  }
}