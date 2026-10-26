import { json } from "../../_lib/http.js";
import { requireUser } from "../../_lib/auth.js";
export async function onRequestGet({ request, env }) {
  const { user, response } = await requireUser(request, env);
  if (response) return response;
  const { results } = await env.DB.prepare(`
    SELECT r.id, s.name AS subject_name, r.score, r.total, r.percentage, r.duration_seconds, r.created_at
    FROM results r JOIN subjects s ON s.id = r.subject_id
    WHERE r.user_id = ? ORDER BY r.created_at DESC LIMIT 100
  `).bind(user.id).all();
  return json({ results: results || [] });
}
