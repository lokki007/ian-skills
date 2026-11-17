// Minimal DeepAPI client: auth headers, idempotency, polling. Never prints the key.
// Configuration comes only from the environment:
//   DEEPAPI_API_KEY       required for paid calls (https://deepapi.co)
//   DEEPAPI_API_BASE_URL  optional, defaults to https://deepapi.co
import { randomUUID } from 'node:crypto';

const BASE = (process.env.DEEPAPI_API_BASE_URL || 'https://deepapi.co').replace(/\/$/, '');

export const hasKey = () => Boolean(process.env.DEEPAPI_API_KEY);
export const spend = { micro: 0, balance: null, calls: [] };
const headers = () => ({ Authorization: `Bearer ${process.env.DEEPAPI_API_KEY}`, 'X-DeepAPI-Skill-Version': 'keyword-skill', 'Content-Type': 'application/json' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function call(path, body, { maxPolls = 12 } = {}) {
  if (!hasKey()) return { status: 'failed', error: { code: 'no_key', message: 'DEEPAPI_API_KEY missing' } };
  let res;
  try {
    res = await (await fetch(BASE + path, { method: 'POST', headers: { ...headers(), 'Idempotency-Key': randomUUID() }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) })).json();
    for (let i = 0; i < maxPolls && res?.next?.method === 'GET'; i++) {
      await sleep((res.next.afterSecs || 5) * 1000);
      res = await (await fetch(BASE + res.next.path, { headers: headers(), signal: AbortSignal.timeout(90000) })).json();
    }
  } catch (e) {
    return { status: 'failed', error: { code: 'network', message: String(e.message || e) } };
  }
  if (res?.debitMicrousd) spend.micro += res.debitMicrousd;
  if (res?.balance?.availableMicrousd != null) spend.balance = res.balance.availableMicrousd;
  spend.calls.push({ path, requestId: res?.requestId, status: res?.status, error: res?.error?.code });
  return res;
}

// Reports a failed request id to DeepAPI so they can debug it. Sends only the request id and a fixed message.
export async function feedback(requestId, message) {
  if (!hasKey()) return;
  try {
    await fetch(`${BASE}/v1/feedback`, { method: 'POST', headers: { ...headers(), 'Idempotency-Key': randomUUID() }, body: JSON.stringify({ category: 'bug', message, context: requestId || undefined }) });
  } catch { /* never blocks */ }
}
