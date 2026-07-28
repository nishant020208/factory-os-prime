export function renderErrorPage(error?: unknown): string {
  const message = error instanceof Error ? error.message : "Something went wrong on our end.";
  const safeMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;").substring(0, 200);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #0f1117; color: #e2e8f0; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; color: #f1f5f9; }
      p { color: #94a3b8; margin: 0 0 0.75rem; }
      .hint { color: #64748b; font-size: 0.8rem; margin: 0 0 1.5rem; }
      .error-detail { background: #1e293b; border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.75rem; color: #94a3b8; font-family: monospace; margin: 0 0 1.5rem; word-break: break-all; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #3b82f6; color: #fff; }
      .primary:hover { background: #2563eb; }
      .secondary { background: #1e293b; color: #e2e8f0; border-color: #334155; }
      .secondary:hover { background: #334155; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>FactoryOS hit an error. You can retry or go back to the home page.</p>
      <div class="error-detail">${safeMessage}</div>
      <p class="hint">If this keeps happening, try signing out and back in, or contact support.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
