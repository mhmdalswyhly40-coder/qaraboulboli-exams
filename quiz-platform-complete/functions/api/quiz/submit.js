import { json, readJson } from "../../_lib/http.js";
import { requireUser, randomToken } from "../../_lib/auth.js";
export async function onRequestPost({ request, env }) {
  const { user, response } = await requireUser(request, env);
  if (response) return response;
  const body = await readJson(request);
  const quizId = String(body?.quizId || "");
  const answers = body?.answers;
  const duration = Math.max(0, Math.min(86400, Number(body?.durationSeconds) || 0));
  if (!quizId || !answers || typeof answers !== "object" || Array.isArray(answers)) return json({ error: "بيانات الاختبار غير مكتملة." }, 400);
  const attempt = await env.DB.prepare("SELECT id, subject_id, question_ids_json, expires_at, submitted_at FROM exam_attempts WHERE id=? AND user_id=?")
    .bind(quizId, user.id).first();
  if (!attempt) return json({ error: "جلسة الاختبار غير موجودة." }, 404);
  if (attempt.submitted_at) return json({ error: "تم تسليم هذا الاختبار مسبقًا." }, 409);
  let questionIds = [];
  try { questionIds = JSON.parse(attempt.question_ids_json); } catch {}
  if (!Array.isArray(questionIds) || !questionIds.length) return json({ error: "تعذر التحقق من أسئلة الاختبار." }, 500);
  // لا نسمح للعميل باختيار مجموعة الأسئلة أو تقليل المقام للحصول على نسبة غير صحيحة.
  const { results: questions } = await env.DB.prepare(
    `SELECT id, correct_option FROM questions WHERE subject_id=? AND id IN (${questionIds.map(()=>"?").join(",")})`
  ).bind(attempt.subject_id, ...questionIds).all();
  const questionMap = new Map((questions || []).map(q => [q.id, q]));
  let score = 0, total = questionIds.length;
  for (const id of questionIds) {
    const q = questionMap.get(id);
    if (q && Number.isInteger(Number(answers[id])) && Number(answers[id]) === q.correct_option) score++;
  }
  const percentage = Math.round((score / total) * 10000) / 100;
  await env.DB.prepare("UPDATE exam_attempts SET submitted_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND submitted_at IS NULL")
    .bind(quizId, user.id).run();
  await env.DB.prepare("INSERT INTO results (id, user_id, subject_id, score, total, percentage, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(randomToken(16), user.id, attempt.subject_id, score, total, percentage, duration).run();
  return json({ result: { score, total, percentage, durationSeconds: duration, expired: Math.floor(Date.now()/1000) > attempt.expires_at } });
}
