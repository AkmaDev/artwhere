"use client";

import { getDeviceId } from "./device";
import type { Moment } from "./types";

export interface Criteria {
  city: string;
  from: string;
  to: string;
  cats: string[];
  moments: Moment[];
  frequency: "now" | "daily";
}

export type PushResult = "ok" | "denied" | "unsupported" | "not-configured" | "failed";

function urlB64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return null;
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

export async function enablePush(c: Criteria): Promise<PushResult> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return "not-configured";
  const reg = await registration();
  if (!reg) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  try {
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key) }));
    return (await sendSubscription(sub, c)) ? "ok" : "failed";
  } catch {
    return "failed";
  }
}

export async function updatePush(c: Criteria): Promise<void> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await sendSubscription(sub, c);
}

export async function disablePush(): Promise<void> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint, deviceId: getDeviceId() }),
  }).catch(() => {});
  await sub.unsubscribe();
}

async function sendSubscription(sub: PushSubscription, c: Criteria): Promise<boolean> {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId: getDeviceId(), subscription: sub.toJSON(), ...c }),
  });
  return res.ok;
}
