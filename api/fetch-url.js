export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { url } = req.body;

  // Intentar con proxy 1
  try {
    const r1 = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "Accept": "text/plain" },
    });
    if (r1.ok) {
      const text = await r1.text();
      if (text.length > 500) {
        console.log("fetch-url jina bytes:", text.length);
        return res.status(200).json({ contents: text.slice(0, 8000) });
      }
    }
  } catch(e) { console.log("jina failed:", e.message); }

  // Intentar con proxy 2
  try {
    const r2 = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
    if (r2.ok) {
      const data = await r2.json();
      if (data.contents?.length > 500) {
        console.log("fetch-url allorigins bytes:", data.contents.length);
        return res.status(200).json({ contents: data.contents.slice(0, 8000) });
      }
    }
  } catch(e) { console.log("allorigins failed:", e.message); }

  // Si todo falla, devuelve vacío
  console.log("fetch-url: all proxies failed");
  res.status(200).json({ contents: "" });
}