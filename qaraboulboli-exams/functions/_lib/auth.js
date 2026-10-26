import { cookieValue, json } from "./http.js";

const encoder = new TextEncoder();
function toB64Url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function fromB64Url(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}
export async function signSession(payload, secret) {
  const body = toB64Url(encoder.encode(JSON.stringify(payload)));
  const signature = toB64Url(await hmac(secret, body));
  return `${body}.${signature}`;
}
export async function verifySession(token, secret) {
  if (!token || !secret || !token.includes(".")) return null;
  try {
    const [body, sig] = token.split(".");
    const expected = await hmac(secret, body);
    const actual = fromB64Url(sig);
    if (expected.length !== actual.length) return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i];
    if (diff !== 0) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64Url(body)));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}
export async function currentUser(request, env) {
  const token = cookieValue(request, "quiz_session");
  const payload = await verifySession(token, env.SESSION_SECRET);
  if (!payload?.uid) return null;
  return await env.DB.prepare("SELECT id, username, full_name, role, active FROM users WHERE id = ?")
    .bind(payload.uid).first();
}
export async function requireUser(request, env) {
  const user = await currentUser(request, env);
  if (!user || !user.active) return { response: json({ error: "يلزم تسجيل الدخول أولًا." }, 401) };
  return { user };
}
export async function requireAdmin(request, env) {
  const result = await requireUser(request, env);
  if (result.response) return result;
  if (result.user.role !== "admin") return { response: json({ error: "هذه العملية متاحة للمدير فقط." }, 403) };
  return result;
}
export function passwordBytes(text) { return encoder.encode(text); }
export async function derivePassword(password, saltBase64) {
  const salt = fromB64Url(saltBase64);
  const key = await crypto.subtle.importKey("raw", passwordBytes(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 180000, hash: "SHA-256" }, key, 256);
  return toB64Url(new Uint8Array(bits));
}
export function randomToken(bytes = 18) {
  return toB64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}
export function saltToken() { return randomToken(16); }
export function sessionCookie(token) {
  return `quiz_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`;
}
export function logoutCookie() {
  return "quiz_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}
