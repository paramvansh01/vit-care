import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The few Razorpay calls the pharmacy checkout needs, over its REST API.
 * Keys come from .env.local; the secret never leaves the server.
 */

const API = "https://api.razorpay.com/v1";

function keys() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  return id && secret ? { id, secret } : null;
}

export function razorpayKeyId() {
  return keys()?.id ?? null;
}

export function razorpayTestMode() {
  return razorpayKeyId()?.startsWith("rzp_test_") ?? false;
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const k = keys();
  if (!k) throw new Error("Razorpay is not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.local.");
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${k.id}:${k.secret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) throw new Error(`Razorpay: ${data.error?.description ?? `HTTP ${res.status}`}`);
  return data;
}

export type GatewayOrder = { id: string; amount: number; currency: string; status: string };

export function createOrder(amountPaise: number, receipt: string, notes: Record<string, string>) {
  return call<GatewayOrder>("/orders", {
    method: "POST",
    body: { amount: amountPaise, currency: "INR", receipt, notes },
  });
}

export type GatewayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method: string;
};

export function fetchPayment(paymentId: string) {
  return call<GatewayPayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

/** Authorised but not yet captured payments are captured explicitly. */
export function capturePayment(paymentId: string, amountPaise: number) {
  return call<GatewayPayment>(`/payments/${encodeURIComponent(paymentId)}/capture`, {
    method: "POST",
    body: { amount: amountPaise, currency: "INR" },
  });
}

export function refundPayment(paymentId: string) {
  return call<{ id: string }>(`/payments/${encodeURIComponent(paymentId)}/refund`, { method: "POST", body: {} });
}

/** Razorpay signs `order_id|payment_id` with the key secret (HMAC-SHA256, hex). */
export function signatureValid(orderId: string, paymentId: string, signature: string) {
  const k = keys();
  if (!k || !signature) return false;
  const expected = createHmac("sha256", k.secret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
