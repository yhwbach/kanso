/** Alerts from automations as system notifications, so they reach the user when Kanso is not the tab in front. */

export type AlertsState = "unsupported" | "default" | "granted" | "denied";

export function alertsState(): AlertsState {
  return "Notification" in window ? Notification.permission : "unsupported";
}

/** Must be called from a click, since browsers ignore permission requests that the user did not start. */
export async function enableAlerts(): Promise<AlertsState> {
  if (alertsState() !== "default") return alertsState();
  return Notification.requestPermission();
}

export async function showSystemAlert(body: string) {
  if (alertsState() !== "granted") return;
  const options = { body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: body };
  // Android only shows notifications through a service worker.
  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) await registration.showNotification("Kanso", options);
  else {
    const notification = new Notification("Kanso", options);
    notification.addEventListener("click", () => window.focus());
  }
}
