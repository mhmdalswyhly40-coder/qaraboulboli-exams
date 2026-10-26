import { json } from "../../_lib/http.js";
import { requireUser } from "../../_lib/auth.js";
export async function onRequestGet({ request, env }) {
  const { response } = await requireUser(request, env);
  if (response) return response;
  const { results } = await env.DB.prepare("SELECT id, name, description, duration_seconds FROM subjects WHERE active = 1 ORDER BY name").all();
  const counts = await env.DB.prepare("SELECT subject_id, COUNT(*) AS count FROM questions GROUP BY subject_id").all();
  const countMap = Object.fromEntries((counts.results || []).map(x => [x.subject_id, x.count]));
  return json({ subjects: (results || []).map(s => ({ ...s, questionCount: countMap[s.id] || 0 })) });
}
