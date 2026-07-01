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
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt, num_inference_steps: 25, image_size: "square_hd" })
    });
    const data = await response.json();
    res.status(200).json({ imageUrl: data.images?.[0]?.url || null });
  } catch (e) {
    res.status(500).json({ imageUrl: null });
  }
}