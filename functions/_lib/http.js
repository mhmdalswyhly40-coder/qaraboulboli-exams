export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });
}
export async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}
export function cookieValue(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const entry = cookie.split(";").map(v => v.trim()).find(v => v.startsWith(name + "="));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}
export function setCookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
export function methodNotAllowed(methods) {
  return json({ error: `الطريقة غير مدعومة. الطرق المسموحة: ${methods.join(", ")}` }, 405, { Allow: methods.join(", ") });
}
