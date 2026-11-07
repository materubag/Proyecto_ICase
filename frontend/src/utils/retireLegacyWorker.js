export async function retireLegacyWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      const worker = registration.active || registration.waiting || registration.installing;
      if (!worker) continue;
      const url = new URL(worker.scriptURL);
      if (url.origin !== location.origin || url.pathname !== '/sw.js') continue;
      // Fetch the retirement worker even when an old page remains controlled.
      try { await registration.update(); }
      catch { await registration.unregister(); }
    }
  } catch {
    // An unavailable browser API must not prevent the application from opening.
  }
}
