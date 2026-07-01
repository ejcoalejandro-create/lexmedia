export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { url } = req.body;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    const text = await response.text();
    res.status(200).json({ contents: text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}