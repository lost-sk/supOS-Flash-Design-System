// The app's visitor route prioritizes the original portal ticket.
// Never substitute the app's identity, a query parameter, or a typed username.
export const IDENTITY_POLICY = 'portal-identity-v1';

export class IdentityError extends Error {
  constructor(message, kind = 'unavailable') { super(message); this.kind = kind; }
}

function stringField(object, names) {
  for (const name of names) {
    const value = object?.[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  }
  return '';
}

export function parseVisitor(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new IdentityError('登录身份返回异常，请重试。');
  }
  if (payload.ok === false || payload.success === false || payload.error ||
      (payload.code !== undefined && !['0', '200', '100000000'].includes(String(payload.code)))) {
    throw new IdentityError('平台未确认当前登录身份，请重新登录后重试。', 'unauthenticated');
  }
  const candidates = [payload.user, payload.data?.user, payload.data, payload];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const username = stringField(candidate, ['username', 'userName', 'user_name', 'login_name']);
    if (!username || username.length > 128 || /[\s\x00-\x1f\x7f"'<>`{}\\]/u.test(username)) continue;
    const subjectType = stringField(candidate, ['subject_type', 'subjectType']).toUpperCase();
    if (subjectType && !['USER', 'PERSON', 'HUMAN'].includes(subjectType)) continue;
    const userId = stringField(candidate, ['user_id', 'userId', 'user_code', 'userCode', 'code', 'id']);
    const displayName = stringField(candidate, ['display_name', 'displayName', 'person_name', 'personName', 'nickname', 'name']);
    return Object.freeze({ username, userId: userId || username, displayName: displayName || username });
  }
  throw new IdentityError('尚未取得当前登录账号，请从 当前平台门户重新打开应用。', 'unauthenticated');
}

export async function makeUserKey(visitor) {
  const original = visitor.username;
  const normalized = original.normalize('NFKC').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  // Ordinary platform login names remain readable and match the agreed names.
  // Non-standard or long names get a stable suffix instead of collapsing together.
  if (/^[a-z][a-z0-9_]{0,23}$/.test(original)) return original;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`trial-v1:${visitor.userId}:${original}`));
  const suffix = Array.from(new Uint8Array(digest).slice(0, 6), b => b.toString(16).padStart(2, '0')).join('');
  let stem = normalized.slice(0, 12) || 'user';
  if (!/^[a-z]/.test(stem)) stem = `u_${stem}`;
  return `${stem}_${suffix}`;
}

export function substitute(text, identity) {
  if (!identity?.username || !identity?.userKey) throw new IdentityError('请先确认当前登录账号。', 'unauthenticated');
  return String(text).replaceAll('{{用户标识}}', identity.userKey).replaceAll('{{当前账号}}', identity.username);
}

export function needsIdentity(text) {
  return /\{\{(?:用户标识|当前账号)\}\}/.test(String(text));
}

export function previewTemplate(text) {
  return String(text).replaceAll('{{用户标识}}', '【账号标识】').replaceAll('{{当前账号}}', '【当前登录账号】');
}

export async function loadIdentity(base, signal) {
  const endpoint = new URL('api/me', new URL(base, location.origin));
  const response = await fetch(endpoint, {
    method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
    headers: { Accept: 'application/json' }, signal,
  });
  if (response.status === 401) throw new IdentityError('未取得有效登录会话，请从当前平台重新打开应用后重试。', 'unauthenticated');
  if (response.status === 403) throw new IdentityError('当前账号无权读取身份信息，请联系平台管理员。', 'forbidden');
  if (!response.ok) throw new IdentityError(`账号信息暂时无法读取（${response.status}），请稍后重试。`);
  let payload;
  try { payload = await response.json(); } catch { throw new IdentityError('平台没有返回账号信息，请从 当前平台门户重新打开。'); }
  const visitor = parseVisitor(payload);
  const userKey = await makeUserKey(visitor);
  return Object.freeze({ ...visitor, userKey });
}
