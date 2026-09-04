import { generateThemeScript, generateThemeSelectorHtml } from '../services/theme';

export function renderPage(title: string, content: string, showThemeSelector: boolean = true): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    :root {
      --bg: #f4f4f4;
      --surface: #ffffff;
      --text: #333333;
      --primary: #6c5ce7;
      --primary-hover: #5a4bd1;
      --border: #dddddd;
      --error: #e74c3c;
      --success: #2ecc71;
    }
    [data-theme="dark"] {
      --bg: #121212;
      --surface: #1e1e1e;
      --text: #e0e0e0;
      --primary: #7c6cf0;
      --primary-hover: #6a5ae0;
      --border: #333333;
      --error: #e74c3c;
      --success: #2ecc71;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
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
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      padding: 30px;
      width: 100%;
      max-width: 480px;
    }
    h1, h2 {
      color: var(--primary);
      margin-bottom: 20px;
      text-align: center;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
    }
    input, select, textarea {
      width: 100%;
      padding: 10px;
      margin-bottom: 15px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface);
      color: var(--text);
      font-size: 16px;
    }
    button {
      width: 100%;
      padding: 12px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 600;
      transition: background 0.2s;
    }
    button:hover {
      background: var(--primary-hover);
    }
    .theme-selector {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      margin-bottom: 20px;
      gap: 10px;
    }
    .theme-selector select {
      width: auto;
      margin: 0;
      padding: 5px;
    }
    .error { color: var(--error); text-align: center; margin-bottom: 10px; }
    .success { color: var(--success); text-align: center; margin-bottom: 10px; }
    a { color: var(--primary); text-decoration: none; }
    a:hover { text-decoration: underline; }
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
