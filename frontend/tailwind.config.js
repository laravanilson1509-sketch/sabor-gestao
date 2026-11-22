/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // cores ligadas aos tokens de app/design-tokens.css (nunca hexadecimal nos componentes novos)
      colors: {
        app: "var(--bg)",
        surface: { DEFAULT: "var(--surface)", elevated: "var(--surface-elevated)", hover: "var(--surface-hover)" },
        line: { DEFAULT: "var(--border)", soft: "var(--border-soft)", strong: "var(--border-strong)" },
        ink: { DEFAULT: "var(--text)", soft: "var(--text-soft)", muted: "var(--text-muted)", subtle: "var(--text-subtle)" },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          soft: "var(--accent-soft)",
          "soft-hover": "var(--accent-soft-hover)",
          faint: "var(--accent-faint)",
          ink: "var(--accent-ink)",
          contrast: "var(--accent-contrast)",
        },
        success: { DEFAULT: "var(--success)", soft: "var(--success-soft)", line: "var(--success-line)" },
        warning: { DEFAULT: "var(--warning)", soft: "var(--warning-soft)", line: "var(--warning-line)", faint: "var(--warning-faint)" },
        danger: {
          DEFAULT: "var(--danger)",
          soft: "var(--danger-soft)",
          line: "var(--danger-line)",
          faint: "var(--danger-faint)",
          solid: "var(--danger-solid)",
          "solid-hover": "var(--danger-solid-hover)",
        },
        info: { DEFAULT: "var(--info)", soft: "var(--info-soft)" },
        violet: { DEFAULT: "var(--violet)", soft: "var(--violet-soft)" },
        gold: "var(--gold)",
      },
      // borda sem cor definida (ex.: só `border`) segue o tema, não o cinza padrão do Tailwind
      borderColor: { DEFAULT: "var(--border)" },
      borderRadius: { token: "var(--radius-md)", card: "var(--radius-lg)" },
      boxShadow: { "token-sm": "var(--shadow-sm)", "token-md": "var(--shadow-md)", "token-lg": "var(--shadow-lg)" },
    },
  },
  plugins: [],
};
