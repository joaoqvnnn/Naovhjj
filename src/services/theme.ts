// Tipos de tema suportados
export type ThemePreference = 'light' | 'dark' | 'system';

// Função para aplicar o tema baseado na preferência
export function getThemeClass(preference: ThemePreference): string {
  switch (preference) {
    case 'light':
      return 'theme-light';
    case 'dark':
      return 'theme-dark';
    case 'system':
    default:
      return 'theme-system';
  }
}

// Função para gerar o script de inicialização do tema no HTML
export function generateThemeScript(): string {
  return `
    <script>
      (function() {
        var theme = localStorage.getItem('theme') || 'system';
        document.documentElement.setAttribute('data-theme', theme);
        if (theme === 'system') {
          var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        }
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
          if (localStorage.getItem('theme') === 'system') {
            document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
          }
        });
      })();
    </script>
  `;
}

// Função para gerar o seletor de tema (HTML)
export function generateThemeSelectorHtml(currentTheme: string = 'system'): string {
  return `
    <div class="theme-selector">
      <label>Tema:</label>
      <select onchange="setTheme(this.value)">
        <option value="system" ${currentTheme === 'system' ? 'selected' : ''}>Sistema</option>
        <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Claro</option>
        <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Escuro</option>
      </select>
    </div>
    <script>
      function setTheme(theme) {
        localStorage.setItem('theme', theme);
        if (theme === 'system') {
          var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
          document.documentElement.setAttribute('data-theme', theme);
        }
      }
    </script>
  `;
}
