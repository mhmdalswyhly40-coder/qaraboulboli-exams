import { json, readJson } from "../../../_lib/http.js";
import { requireAdmin, randomToken } from "../../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const { response } = await requireAdmin(request, env);
  if (response) return response;
  const url = new URL(request.url);
  const subjectId = url.searchParams.get("subjectId");
  const query = subjectId
    ? env.DB.prepare("SELECT q.id, q.subject_id, s.name AS subject_name, q.prompt, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.explanation, q.created_at FROM questions q JOIN subjects s ON s.id=q.subject_id WHERE q.subject_id=? ORDER BY q.created_at DESC LIMIT 500").bind(subjectId)
    : env.DB.prepare("SELECT q.id, q.subject_id, s.name AS subject_name, q.prompt, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.explanation, q.created_at FROM questions q JOIN subjects s ON s.id=q.subject_id ORDER BY q.created_at DESC LIMIT 500");
  const { results } = await query.all();
  return json({ questions: results || [] });
}
export async function onRequestPost({ request, env }) {
  const { user, response } = await requireAdmin(request, env);
  if (response) return response;
  const b = await readJson(request);
  const subjectId = String(b?.subjectId || "");
  const prompt = String(b?.prompt || "").trim();
  const options = Array.isArray(b?.options) ? b.options.map(x => String(x).trim()) : [];
  const correct = Number(b?.correctOption);
  const explanation = String(b?.explanation || "").trim().slice(0,2000);
  if (prompt.length < 5 || prompt.length > 2000) return json({ error: "السؤال يجب أن يكون بين 5 و2000 حرف." }, 400);
  if (options.length !== 4 || options.some(x => !x || x.length > 500)) return json({ error: "أدخل أربعة خيارات، كل خيار حتى 500 حرف." }, 400);
  if (!Number.isInteger(correct) || correct < 0 || correct > 3) return json({ error: "حدد الإجابة الصحيحة." }, 400);
  const subject = await env.DB.prepare("SELECT id FROM subjects WHERE id=?").bind(subjectId).first();
  if (!subject) return json({ error: "المادة غير موجودة." }, 404);
  await env.DB.prepare("INSERT INTO questions (id, subject_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(randomToken(16), subjectId, prompt, options[0], options[1], options[2], options[3], correct, explanation).run();
  return json({ ok: true }, 201);
}
export async function onRequestDelete({ request, env }) {
  const { response } = await requireAdmin(request, env);
  if (response) return response;
  const b = await readJson(request);
  const id = String(b?.id || "");
  if (!id) return json({ error: "معرّف السؤال مطلوب." }, 400);
  const result = await env.DB.prepare("DELETE FROM questions WHERE id=?").bind(id).run();
  if (!result.meta?.changes) return json({ error: "السؤال غير موجود." }, 404);
  return json({ ok: true });
}
