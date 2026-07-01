import { useState, useRef, useEffect } from "react";

const CONFIG = {
  ANTHROPIC_MODEL: "claude-sonnet-4-6",
  FAL_API_KEY: "91863bfb-237e-4f4b-9308-3430c4d2ec62:0a1c3133c2d878250d01ffada461ea1d",
  LINKEDIN_ACCESS_TOKEN: "", LINKEDIN_PERSON_URN: "",
  TWITTER_API_KEY: "",       TWITTER_ACCESS_TOKEN: "",
  FACEBOOK_ACCESS_TOKEN: "", FACEBOOK_PAGE_ID: "",
  INSTAGRAM_ACCESS_TOKEN: "", INSTAGRAM_ACCOUNT_ID: "",
  THREADS_ACCESS_TOKEN: "",  THREADS_USER_ID: "",
};

const REDES = [
  { id: "linkedin",  label: "LinkedIn" },
  { id: "instagram", label: "Instagram" },
  { id: "twitter",   label: "X / Twitter" },
  { id: "facebook",  label: "Facebook" },
  { id: "threads",   label: "Threads" },
];

// ─── HELPERS ───────────────────────────────────
function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// Llama a Claude via función serverless /api/claude
async function callClaude(system, userContent) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CONFIG.ANTHROPIC_MODEL,
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "";
  try { return JSON.parse(text.replace(/```json|```/g, "").trim()); }
  catch { return { raw: text }; }
}

// Analiza imagen via función serverless /api/claude
async function analyzeImageWithClaude(base64, mediaType) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CONFIG.ANTHROPIC_MODEL,
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: `Analiza esta imagen de la competencia. Devuelve SOLO JSON válido:
{
  "estilo": "descripción del estilo visual",
  "tema": "tema en 3-5 palabras",
  "elementos": "elementos visuales clave",
  "tono": "tono emocional",
  "prompt_inspirado": "prompt en inglés para SDXL, imagen distinta pero mismo tema, formato cuadrado, profesional",
  "descripcion_contenido": "de qué trata el contenido, 2-3 frases en español"
}` }
        ]
      }],
    }),
  });
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "";
  try { return JSON.parse(text.replace(/```json|```/g, "").trim()); }
  catch { return { raw: text, prompt_inspirado: "Professional legal social media illustration, clean design" }; }
}

// Extrae contenido de URL via función serverless /api/fetch-url
async function fetchArticleContent(url) {
  const res = await fetch("/api/fetch-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  const html = data.contents || "";
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 8000);
}

async function getYoutubeTitle(videoId) {
  const res = await fetch("/api/fetch-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}` }),
  });
  const data = await res.json();
  const m = data.contents?.match(/<title>(.+?)<\/title>/);
  return `Título del video: ${m ? m[1].replace(" - YouTube", "") : videoId}`;
}

// Genera imagen via función serverless /api/generate-image
async function generateImageFal(prompt) {
  const res = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  return data.imageUrl || null;
}

// ─── PIPELINES ─────────────────────────────────
const POST_PROMPTS = {
  linkedin:  `Post profesional LinkedIn 600-1100 chars. JSON: {"post":"..."}. Hook + párrafos cortos + 3-5 hashtags. Tono jurídico profesional.`,
  instagram: `Caption Instagram 700-1500 chars. JSON: {"post":"..."}. Emojis moderados + 5-8 hashtags + CTA.`,
  twitter:   `Tweet máx 270 chars. JSON: {"post":"..."}. Hook + idea clave. Sin listas.`,
  facebook:  `Post Facebook 300-800 chars. JSON: {"post":"..."}. Tono cercano. Pregunta al final.`,
  threads:   `Post Threads máx 500 chars. JSON: {"post":"..."}. Conversacional. Perspectiva propia.`,
};

async function procesarURL(url, redes, onLog) {
  const logs = []; const log = m => { logs.push(m); onLog([...logs]); };
  const isYt = url.includes("youtube.com") || url.includes("youtu.be");
  let contenido = "";
  if (isYt) {
    const m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})|youtu\.be\/([a-zA-Z0-9_-]{11})/);
    log("Extrayendo información del vídeo…");
    contenido = await getYoutubeTitle(m?.[1] || m?.[2]);
  } else {
    log("Extrayendo contenido del artículo…");
    contenido = await fetchArticleContent(url);
  }
  log("Generando resumen con IA…");
  const r = await callClaude(
    `Experto en content marketing jurídico. Devuelve SOLO JSON válido: {"resumen":"150-200 palabras en español, tono profesional","tema":"3 palabras"}`,
    `URL: ${url}\n\n${contenido}`
  );
  const resumen = r.resumen || r.raw || "Contenido procesado.";
  const tema = r.tema || "contenido jurídico";
  log(`Resumen generado — tema: ${tema}`);
  const posts = {};
  for (const red of redes) {
    log(`Redactando publicación para ${red}…`);
    const p = await callClaude(POST_PROMPTS[red], `Resumen: ${resumen}\nURL: ${url}\nContexto: estudio jurídico profesional`);
    posts[red] = p.post || p.raw || resumen;
  }
  log("Generando imagen…");
  const ip = await callClaude(
    `Prompt en inglés para imagen profesional para despacho de abogados, redes sociales. JSON: {"prompt":"...SDXL..."}`,
    `Tema: ${tema}\nResumen: ${resumen}`
  );
  const imagePrompt = ip.prompt || `Professional legal office illustration, clean minimalist design`;
  let imageUrl = null;
  try {
    imageUrl = await generateImageFal(imagePrompt);
    if (imageUrl) log("Imagen generada correctamente.");
    else log("Sin imagen — configura FAL_API_KEY en Vercel.");
  } catch(e) { log(`Advertencia imagen: ${e.message}`); }
  return { resumen, posts, imageUrl, imagePrompt, logs };
}

async function procesarImagenCompetencia(file, redes, onLog) {
  const logs = []; const log = m => { logs.push(m); onLog([...logs]); };
  log("Analizando imagen con visión artificial…");
  const base64 = await toBase64(file);
  const analisis = await analyzeImageWithClaude(base64, file.type || "image/jpeg");
  log(`Tema detectado: ${analisis.tema || "contenido visual"}`);
  log(`Estilo: ${analisis.estilo?.slice(0, 55) || "—"}…`);
  log("Redactando tu versión original…");
  const contexto = analisis.descripcion_contenido || analisis.raw || "Contenido visual detectado";
  const posts = {};
  for (const red of redes) {
    log(`Redactando publicación para ${red}…`);
    const p = await callClaude(
      POST_PROMPTS[red] + " IMPORTANTE: crea contenido 100% original, no copies a la competencia.",
      `Tema: ${analisis.tema}\nDescripción: ${contexto}\nContexto: estudio jurídico profesional`
    );
    posts[red] = p.post || p.raw || contexto;
  }
  const imagePrompt = analisis.prompt_inspirado || `Professional legal illustration, different style, clean modern design`;
  log("Generando imagen alternativa…");
  let imageUrl = null;
  try {
    imageUrl = await generateImageFal(imagePrompt);
    if (imageUrl) log("Imagen generada correctamente.");
    else log("Sin imagen — configura FAL_API_KEY en Vercel.");
  } catch(e) { log(`Advertencia imagen: ${e.message}`); }
  return { analisis, resumen: contexto, posts, imageUrl, imagePrompt, logs, modoCompetencia: true };
}

// ─── ESTILOS ───────────────────────────────────
const S = {
  page: { minHeight: "100vh", background: "#fafafa", color: "#111", fontFamily: "'Georgia','Times New Roman',serif" },
  header: { background: "#111", padding: "0 48px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, borderBottom: "1px solid #000" },
  headerLogo: { display: "flex", alignItems: "center", gap: 14 },
  logoMark: { width: 32, height: 32, border: "1.5px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", fontStyle: "italic", fontFamily: "Georgia,serif", letterSpacing: 1 },
  logoText: { color: "#fff", fontSize: 13, fontWeight: 400, letterSpacing: 3, textTransform: "uppercase", fontFamily: "Georgia,serif" },
  logoSub: { color: "#888", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Arial,sans-serif", marginTop: 1 },
  headerRight: { display: "flex", alignItems: "center", gap: 20 },
  pill: { fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#888", fontFamily: "Arial,sans-serif", border: "0.5px solid #444", padding: "3px 10px" },
  main: { maxWidth: 860, margin: "0 auto", padding: "48px 32px 80px" },
  section: { borderTop: "1px solid #ddd", paddingTop: 28, marginBottom: 32 },
  sectionTitle: { fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#888", fontFamily: "Arial,sans-serif", marginBottom: 20 },
  modeRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, border: "1px solid #ddd", marginBottom: 32 },
  modeBtn: (active) => ({ padding: "18px 24px", background: active ? "#111" : "#fff", color: active ? "#fff" : "#888", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "Arial,sans-serif", transition: "all .15s" }),
  modeBtnTitle: (active) => ({ display: "block", fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: active ? "#fff" : "#333", marginBottom: 3 }),
  modeBtnSub: { display: "block", fontSize: 11, color: "#999" },
  input: { width: "100%", background: "#fff", border: "1px solid #ddd", borderRadius: 0, color: "#111", padding: "12px 16px", fontSize: 13, fontFamily: "Arial,sans-serif", boxSizing: "border-box", outline: "none" },
  redBtn: (active) => ({ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", border: `1px solid ${active ? "#111" : "#ddd"}`, background: active ? "#111" : "#fff", color: active ? "#fff" : "#888", cursor: "pointer", fontFamily: "Arial,sans-serif", fontSize: 11, letterSpacing: 1, fontWeight: 600, textTransform: "uppercase", transition: "all .12s" }),
  btnPrimary: (disabled) => ({ width: "100%", background: disabled ? "#ddd" : "#111", color: disabled ? "#aaa" : "#fff", border: "none", padding: "16px 32px", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", fontFamily: "Arial,sans-serif", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer" }),
  log: { background: "#fff", border: "1px solid #e8e8e8", padding: "16px 20px", fontFamily: "Arial,sans-serif", fontSize: 11, color: "#666", lineHeight: 2, borderLeft: "3px solid #111" },
  postCard: { background: "#fff", border: "1px solid #e0e0e0", marginBottom: 1 },
  postCardHeader: { padding: "10px 18px", borderBottom: "1px solid #ebebeb", display: "flex", alignItems: "center", gap: 10, background: "#fafafa" },
  postCardDot: { width: 8, height: 8, background: "#111", borderRadius: "50%" },
  postCardLabel: { fontSize: 10, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Arial,sans-serif", fontWeight: 600, color: "#333", flex: 1 },
  postCardChars: { fontSize: 10, color: "#bbb", fontFamily: "Arial,sans-serif" },
  copyBtn: (copied) => ({ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontFamily: "Arial,sans-serif", border: `1px solid ${copied ? "#111" : "#ddd"}`, background: copied ? "#111" : "#fff", color: copied ? "#fff" : "#aaa", padding: "4px 12px", cursor: "pointer" }),
  postCardBody: { padding: "18px 20px", fontSize: 13, lineHeight: 1.85, color: "#333", fontFamily: "Arial,sans-serif", whiteSpace: "pre-wrap", wordBreak: "break-word" },
};

// ─── COMPONENTES ───────────────────────────────
function RedIcon({ id }) {
  const icons = {
    linkedin: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
    instagram: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>,
    twitter: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
    facebook: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
    threads: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M9 9.5c0-1.5 1.2-2.5 3-2.5s3 1 3 2.5-1.5 2-3.5 2.5c-2 .5-3 1.5-3 3s1.5 2.5 3.5 2.5 3.5-1 3.5-2.5"/></svg>,
  };
  return icons[id] || <span style={{ fontSize: 12 }}>{id[0].toUpperCase()}</span>;
}

function PostCard({ red, post, imageUrl }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={S.postCard}>
      <div style={S.postCardHeader}>
        <div style={S.postCardDot} />
        <span style={S.postCardLabel}>{red.label}</span>
        <span style={S.postCardChars}>{post.length} caracteres</span>
        <button onClick={() => { navigator.clipboard.writeText(post); setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={S.copyBtn(copied)}>
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      {imageUrl && <img src={imageUrl} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block", borderBottom: "1px solid #ebebeb" }} />}
      <div style={S.postCardBody}>{post}</div>
    </div>
  );
}

function LogLine({ text }) {
  const [vis, setVis] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVis(true), 30); return () => clearTimeout(t); }, []);
  return (
    <div style={{ opacity: vis ? 1 : 0, transition: "opacity .3s", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ color: "#bbb", fontSize: 10, fontFamily: "Arial,sans-serif" }}>—</span>
      <span>{text}</span>
    </div>
  );
}

function DropZone({ file, setFile, preview, setPreview }) {
  const ref = useRef();
  const onFile = f => {
    if (!f || !f.type.startsWith("image/")) return;
    setFile(f);
    const r = new FileReader();
    r.onload = e => setPreview(e.target.result);
    r.readAsDataURL(f);
  };
  return (
    <div onClick={() => ref.current.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
      style={{ border: `1px dashed ${file ? "#111" : "#ccc"}`, padding: file ? 0 : "40px 20px", textAlign: "center", cursor: "pointer", background: "#fff", overflow: "hidden", position: "relative" }}>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={e => onFile(e.target.files[0])} />
      {file ? (
        <>
          <img src={preview} alt="" style={{ width: "100%", maxHeight: 300, objectFit: "contain", display: "block" }} />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: "rgba(0,0,0,.6)", padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#fff", fontSize: 11, fontFamily: "Arial,sans-serif" }}>{file.name.slice(0, 40)}</span>
            <button onClick={e => { e.stopPropagation(); setFile(null); setPreview(null); }} style={{ background: "none", border: "1px solid #fff", color: "#fff", padding: "2px 8px", cursor: "pointer", fontSize: 11 }}>Quitar</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 28, marginBottom: 10, opacity: .3 }}>↑</div>
          <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Arial,sans-serif", color: "#888" }}>Arrastra o selecciona imagen</div>
          <div style={{ fontSize: 11, color: "#bbb", marginTop: 6, fontFamily: "Arial,sans-serif" }}>JPG · PNG · WEBP</div>
        </>
      )}
    </div>
  );
}

// ─── APP ───────────────────────────────────────
export default function App() {
  const [modo, setModo] = useState("url");
  const [entries, setEntries] = useState([{ id: 1, url: "" }]);
  const [redes, setRedes] = useState(["linkedin", "instagram", "twitter", "facebook", "threads"]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const toggleRed = id => setRedes(p => p.includes(id) ? p.filter(r => r !== id) : [...p, id]);
  const reset = () => { setResult(null); setLogs([]); setError(null); };

  const run = async () => {
    setProcessing(true); setError(null); setResult(null); setLogs([]);
    try {
      const res = modo === "url"
        ? await procesarURL(entries.find(e => e.url.trim())?.url.trim(), redes, setLogs)
        : await procesarImagenCompetencia(file, redes, setLogs);
      setResult(res);
    } catch (e) { setError(e.message); }
    finally { setProcessing(false); }
  };

  const canRun = !processing && redes.length > 0 && (modo === "url" ? entries.some(e => e.url.trim()) : !!file);

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.headerLogo}>
          <div style={S.logoMark}>L</div>
          <div>
            <div style={S.logoText}>LexMedia</div>
            <div style={S.logoSub}>Gestión de contenido jurídico</div>
          </div>
        </div>
        <div style={S.headerRight}>
          <span style={S.pill}>IA · Abogados de Salud Córdoba</span>
          <span style={S.pill}>@abogadosalud.cordoba</span>
        </div>
      </header>

      <div style={{ background: "#fff", borderBottom: "1px solid #e0e0e0", padding: "20px 48px", display: "flex", alignItems: "baseline", gap: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 400, fontFamily: "Georgia,serif", color: "#111", letterSpacing: -0.5 }}>Publicador Inteligente</h1>
        <span style={{ fontSize: 12, color: "#aaa", fontFamily: "Arial,sans-serif", letterSpacing: 1 }}>Gestor de redes sociales</span>
      </div>

      <main style={S.main}>

        <div style={S.section}>
          <div style={S.sectionTitle}>01 — Origen del contenido</div>
          <div style={S.modeRow}>
            <button style={S.modeBtn(modo === "url")} onClick={() => { setModo("url"); reset(); }}>
              <span style={S.modeBtnTitle(modo === "url")}>Desde URL</span>
              <span style={S.modeBtnSub}>Artículo, noticia, vídeo de YouTube…</span>
            </button>
            <button style={S.modeBtn(modo === "competencia")} onClick={() => { setModo("competencia"); reset(); }}>
              <span style={S.modeBtnTitle(modo === "competencia")}>Inspiración en competencia</span>
              <span style={S.modeBtnSub}>Sube su imagen → tu versión original distinta</span>
            </button>
          </div>

          {modo === "url" && (
            <div>
              {entries.map(e => (
                <div key={e.id} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input type="url" value={e.url}
                    onChange={ev => setEntries(p => p.map(x => x.id === e.id ? { ...x, url: ev.target.value } : x))}
                    placeholder="https://ejemplo.com/articulo o https://youtube.com/watch?v=…"
                    style={S.input} />
                  {entries.length > 1 && (
                    <button onClick={() => setEntries(p => p.filter(x => x.id !== e.id))}
                      style={{ background: "#fff", border: "1px solid #ddd", color: "#aaa", padding: "0 16px", cursor: "pointer", fontSize: 16 }}>✕</button>
                  )}
                </div>
              ))}
              <button onClick={() => setEntries(p => [...p, { id: Date.now(), url: "" }])}
                style={{ background: "none", border: "none", color: "#aaa", fontSize: 11, fontFamily: "Arial,sans-serif", letterSpacing: 1, textTransform: "uppercase", cursor: "pointer", padding: "8px 0" }}>
                + Añadir otra URL
              </button>
            </div>
          )}

          {modo === "competencia" && (
            <DropZone file={file} setFile={setFile} preview={preview} setPreview={setPreview} />
          )}
        </div>

        <div style={S.section}>
          <div style={S.sectionTitle}>02 — Redes sociales destino</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {REDES.map(r => (
              <button key={r.id} style={S.redBtn(redes.includes(r.id))} onClick={() => toggleRed(r.id)}>
                <span style={{ opacity: redes.includes(r.id) ? 1 : 0.4 }}><RedIcon id={r.id} /></span>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div style={S.section}>
          <div style={S.sectionTitle}>03 — Generar publicaciones</div>
          <button onClick={canRun ? run : undefined} style={S.btnPrimary(!canRun)}>
            {processing ? "Procesando…" : modo === "url" ? "Generar publicaciones" : "Analizar y generar mi versión"}
          </button>
        </div>

        {logs.length > 0 && (
          <div style={{ ...S.section, borderTopColor: "transparent", paddingTop: 0 }}>
            <div style={S.log}>
              {logs.map((l, i) => <LogLine key={i} text={l} />)}
              {processing && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <span style={{ color: "#bbb", fontSize: 10, fontFamily: "Arial" }}>—</span>
                  <span style={{ color: "#aaa", fontSize: 11, fontFamily: "Arial", letterSpacing: 1 }}>trabajando…</span>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div style={{ borderLeft: "3px solid #c00", padding: "12px 16px", background: "#fff9f9", fontSize: 12, fontFamily: "Arial,sans-serif", color: "#c00", marginBottom: 24 }}>
            {error}
          </div>
        )}

        {result && (
          <div>
            {result.modoCompetencia && preview && (
              <div style={S.section}>
                <div style={S.sectionTitle}>Comparativa — competencia vs tu versión</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, border: "1px solid #e0e0e0" }}>
                  <div>
                    <div style={{ padding: "8px 14px", background: "#fafafa", borderBottom: "1px solid #e0e0e0", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Arial,sans-serif", color: "#999" }}>Competencia</div>
                    <img src={preview} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                  </div>
                  <div>
                    <div style={{ padding: "8px 14px", background: "#111", borderBottom: "1px solid #000", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Arial,sans-serif", color: "#fff" }}>Tu versión IA</div>
                    {result.imageUrl
                      ? <img src={result.imageUrl} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                      : <div style={{ aspectRatio: "1", background: "#f8f8f8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#ccc", fontFamily: "Arial" }}>Añade FAL_API_KEY en Vercel para imagen real</div>
                    }
                  </div>
                </div>
              </div>
            )}

            {!result.modoCompetencia && result.imageUrl && (
              <div style={S.section}>
                <div style={S.sectionTitle}>Imagen generada</div>
                <img src={result.imageUrl} alt="" style={{ width: "100%", maxHeight: 320, objectFit: "cover", display: "block", border: "1px solid #e0e0e0" }} />
              </div>
            )}

            <div style={S.section}>
              <div style={S.sectionTitle}>{result.modoCompetencia ? "Contenido detectado" : "Resumen del contenido"}</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.9, color: "#444", fontFamily: "Georgia,serif", borderLeft: "2px solid #ddd", paddingLeft: 20 }}>
                {result.resumen}
              </p>
            </div>

            <div style={S.section}>
              <div style={S.sectionTitle}>Publicaciones generadas — {redes.length} redes</div>
              {redes.map(redId => {
                const red = REDES.find(r => r.id === redId);
                return result.posts[redId] ? <PostCard key={redId} red={red} post={result.posts[redId]} imageUrl={result.imageUrl} /> : null;
              })}
            </div>

            <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: 24 }}>
              <button onClick={reset} style={{ background: "none", border: "1px solid #ddd", color: "#888", padding: "10px 24px", cursor: "pointer", fontSize: 11, fontFamily: "Arial,sans-serif", letterSpacing: 2, textTransform: "uppercase" }}>
                Nueva publicación
              </button>
            </div>
          </div>
        )}
      </main>

      <footer style={{ borderTop: "1px solid #e0e0e0", padding: "20px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" }}>
        <span style={{ fontSize: 10, color: "#bbb", fontFamily: "Arial,sans-serif", letterSpacing: 2, textTransform: "uppercase" }}>LexMedia · Gestión de contenido jurídico con IA</span>
        <span style={{ fontSize: 10, color: "#ddd", fontFamily: "Arial,sans-serif" }}></span>
      </footer>
    </div>
  );
}
