/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // VS Code theme tokens consumed via CSS variables (see app/globals.css).
        cpFg: 'var(--vscode-foreground)',
        cpMuted: 'var(--vscode-descriptionForeground)',
        cpBg: 'var(--vscode-editor-background)',
        cpBorder: 'var(--vscode-widget-border)',
        cpAccent: 'var(--vscode-textLink-foreground)',
      },
      fontFamily: {
        sans: [
          'var(--vscode-font-family, system-ui)',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'var(--vscode-editor-font-family, ui-monospace)',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};
