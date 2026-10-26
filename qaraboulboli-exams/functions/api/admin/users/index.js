import { json } from "../../../_lib/http.js";
import { requireAdmin } from "../../../_lib/auth.js";
export async function onRequestGet({ request, env }) {
  const { response } = await requireAdmin(request, env);
  if (response) return response;
  const { results } = await env.DB.prepare(`
    SELECT u.id, u.username, u.full_name, u.role, u.active, u.created_at,
      COUNT(r.id) AS attempts,
      COALESCE(ROUND(AVG(r.percentage), 2), 0) AS average_percentage,
      COALESCE(MAX(r.percentage), 0) AS best_percentage
    FROM users u LEFT JOIN results r ON r.user_id = u.id
    GROUP BY u.id ORDER BY u.created_at DESC LIMIT 500
  `).all();
  return json({ users: results || [] });
}
