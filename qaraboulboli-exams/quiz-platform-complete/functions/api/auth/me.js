import { json } from "../../_lib/http.js";
import { requireUser } from "../../_lib/auth.js";
export async function onRequestGet({ request, env }) {
  const { user, response } = await requireUser(request, env);
  if (response) return response;
  return json({ user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role } });
}
