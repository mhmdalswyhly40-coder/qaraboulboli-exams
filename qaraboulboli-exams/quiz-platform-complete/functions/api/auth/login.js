import { json, readJson } from "../../_lib/http.js";
import { derivePassword, signSession, sessionCookie } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const username = String(body?.username || "").trim().toLowerCase();
  const password = String(body?.password || "");
  if (!username || !password) return json({ error: "أدخل اسم المستخدم وكلمة المرور." }, 400);
  const user = await env.DB.prepare("SELECT id, username, full_name, password_hash, password_salt, role, active FROM users WHERE username = ?")
    .bind(username).first();
  if (!user || !user.active) return json({ error: "بيانات الدخول غير صحيحة أو الحساب موقوف." }, 401);
  const hash = await derivePassword(password, user.password_salt);
  if (hash !== user.password_hash) return json({ error: "بيانات الدخول غير صحيحة أو الحساب موقوف." }, 401);
  const token = await signSession({ uid: user.id, exp: Math.floor(Date.now()/1000) + 43200 }, env.SESSION_SECRET);
  return json({ user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role } }, 200, { "Set-Cookie": sessionCookie(token) });
}
