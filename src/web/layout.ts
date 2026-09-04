import { generateThemeScript, generateThemeSelectorHtml } from '../services/theme';

export function renderPage(title: string, content: string, showThemeSelector: boolean = true): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Larizinha Store</title>
  <style>
    :root {
      --bg: #f4f6f9;
      --surface: #ffffff;
      --text: #1e293b;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --border: #e2e8f0;
      --error: #ef4444;
      --success: #22c55e;
      --radius: 12px;
      --shadow: 0 4px 6px rgba(0,0,0,0.05);
    }
    [data-theme="dark"] {
      --bg: #0f172a;
      --surface: #1e293b;
      --text: #f1f5f9;
      --primary: #818cf8;
      --primary-hover: #6366f1;
      --border: #334155;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
      transition: background 0.3s, color 0.3s;
    }
    .container {
      background: var(--surface);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 32px;
      width: 100%;
      max-width: 460px;
    }
    h1, h2 {
      color: var(--primary);
      margin-bottom: 20px;
      font-weight: 600;
      text-align: center;
    }
    label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      font-size: 14px;
    }
    input, select {
      width: 100%;
      padding: 12px;
      margin-bottom: 16px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--text);
      font-size: 15px;
      transition: border-color 0.2s;
    }
    input:focus, select:focus {
      outline: none;
      border-color: var(--primary);
    }
    button {
      width: 100%;
      padding: 12px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 600;
      transition: background 0.2s;
    }
    button:hover {
      background: var(--primary-hover);
    }
    .error { color: var(--error); text-align: center; margin-bottom: 12px; }
    .success { color: var(--success); text-align: center; margin-bottom: 12px; }
    a { color: var(--primary); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .theme-selector {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      margin-bottom: 16px;
      gap: 8px;
      font-size: 14px;
    }
    .theme-selector select {
      width: auto;
      margin: 0;
      padding: 4px 8px;
    }
  </style>
  ${generateThemeScript()}
</head>
<body>
  <div class="container">
    ${showThemeSelector ? generateThemeSelectorHtml() : ''}
    <h1>${title}</h1>
    ${content}
  </div>
</body>
</html>`;
}
