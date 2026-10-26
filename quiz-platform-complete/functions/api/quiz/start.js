import { json, readJson } from "../../_lib/http.js";
import { requireUser, randomToken } from "../../_lib/auth.js";
export async function onRequestPost({ request, env }) {
  const { user, response } = await requireUser(request, env);
  if (response) return response;
  const body = await readJson(request);
  const subjectId = String(body?.subjectId || "");
  const subject = await env.DB.prepare("SELECT id, name, duration_seconds FROM subjects WHERE id = ? AND active = 1").bind(subjectId).first();
  if (!subject) return json({ error: "المادة غير موجودة." }, 404);
  const { results } = await env.DB.prepare("SELECT id, prompt, option_a, option_b, option_c, option_d FROM questions WHERE subject_id = ? ORDER BY RANDOM() LIMIT 30").bind(subjectId).all();
  if (!results?.length) return json({ error: "لا توجد أسئلة في هذه المادة حتى الآن." }, 400);
  const duration = Math.max(60, Math.min(7200, Number(subject.duration_seconds) || 1800));
  const quizId = randomToken(18);
  const expiresAt = Math.floor(Date.now()/1000) + duration;
  await env.DB.prepare("INSERT INTO exam_attempts (id, user_id, subject_id, question_ids_json, expires_at) VALUES (?, ?, ?, ?, ?)")
    .bind(quizId, user.id, subjectId, JSON.stringify(results.map(q => q.id)), expiresAt).run();
  const questions = results.map(q => ({ id:q.id, prompt:q.prompt, options:[q.option_a,q.option_b,q.option_c,q.option_d] }));
  return json({ quizId, subject: { id:subject.id, name:subject.name }, durationSeconds: duration, expiresAt, questions });
}
