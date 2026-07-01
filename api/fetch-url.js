export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { url } = req.body;
  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        "Accept": "application/json",
        "X-Return-Format": "text",
      },
    });
    const text = await response.text();
    console.log("jina bytes:", text.length, "status:", response.status);
    res.status(200).json({ contents: text.slice(0, 8000) });
  } catch (e) {
    console.error("jina error:", e.message);
    res.status(200).json({ contents: "" });
  }
}