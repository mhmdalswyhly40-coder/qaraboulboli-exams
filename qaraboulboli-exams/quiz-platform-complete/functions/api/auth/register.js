import { json, readJson } from "../../_lib/http.js";
import { derivePassword, randomToken, saltToken, signSession, sessionCookie } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const fullName = String(body?.fullName || "").trim();
  const username = String(body?.username || "").trim().toLowerCase();
  const password = String(body?.password || "");
  if (fullName.length < 3 || fullName.length > 100) return json({ error: "الاسم يجب أن يكون بين 3 و100 حرف." }, 400);
  if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) return json({ error: "اسم المستخدم: 3 إلى 30 حرفًا إنجليزيًا أو أرقامًا أو . _ -" }, 400);
  if (password.length < 10 || password.length > 128) return json({ error: "كلمة المرور يجب أن تكون 10 أحرف على الأقل." }, 400);
  const id = randomToken(16), salt = saltToken(), passwordHash = await derivePassword(password, salt);
  try {
    await env.DB.prepare("INSERT INTO users (id, username, full_name, password_hash, password_salt, role) VALUES (?, ?, ?, ?, ?, 'student')")
      .bind(id, username, fullName, passwordHash, salt).run();
  } catch {
    return json({ error: "اسم المستخدم مستخدم مسبقًا، اختر اسمًا آخر." }, 409);
  }
  const token = await signSession({ uid: id, exp: Math.floor(Date.now()/1000) + 43200 }, env.SESSION_SECRET);
  return json({ user: { id, username, fullName, role: "student" } }, 201, { "Set-Cookie": sessionCookie(token) });
}
