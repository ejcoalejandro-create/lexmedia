export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { prompt } = req.body;
  const falKey = process.env.FAL_API_KEY;
  if (!falKey) return res.status(200).json({ imageUrl: null });
  try {
    const response = await fetch("https://fal.run/fal-ai/fast-sdxl", {
      method: "POST",
      headers: {
        "Authorization": `Key ${falKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ prompt, num_inference_steps: 25, image_size: "square_hd" })
    });
    const text = await response.text();
    console.log("fal.ai response:", text);
    const data = JSON.parse(text);
    const imageUrl = data.images?.[0]?.url || data.image?.url || null;
    res.status(200).json({ imageUrl });
  } catch (e) {
    console.error("fal.ai error:", e.message);
    res.status(200).json({ imageUrl: null, error: e.message });
  }
}