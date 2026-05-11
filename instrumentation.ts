import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: Parameters<typeof Sentry.captureRequestError>[0] extends infer _T
  ? (
      err: unknown,
      request: Parameters<typeof Sentry.captureRequestError>[1],
      context: Parameters<typeof Sentry.captureRequestError>[2],
    ) => Promise<void>
  : never = async (err, request, context) => {
  Sentry.captureRequestError(err, request, context);

  const error = err as { message: string; stack?: string };
  const url = process.env.PILOTDECK_ERROR_WEBHOOK_URL;
  const secret = process.env.PILOTDECK_ERROR_SECRET;
  if (!url || !secret) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": secret,
      },
      body: JSON.stringify({
        app_slug: process.env.APP_SLUG || "unknown",
        type: "server",
        message: error.message,
        stack: error.stack?.slice(0, 4000),
        routePath: context.routePath || request.path,
        routeType: context.routeType,
        method: request.method,
        url: request.path,
      }),
    });
  } catch {
    // Silent fail — don't crash the app for monitoring
  }
};
