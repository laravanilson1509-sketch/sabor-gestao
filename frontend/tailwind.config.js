/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // cores ligadas aos tokens de app/design-tokens.css (nunca hexadecimal nos componentes novos)
      colors: {
        app: "var(--bg)",
        surface: { DEFAULT: "var(--surface)", elevated: "var(--surface-elevated)", hover: "var(--surface-hover)" },
        line: { DEFAULT: "var(--border)", strong: "var(--border-strong)" },
        ink: { DEFAULT: "var(--text)", muted: "var(--text-muted)", subtle: "var(--text-subtle)" },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          soft: "var(--accent-soft)",
          contrast: "var(--accent-contrast)",
        },
        success: { DEFAULT: "var(--success)", soft: "var(--success-soft)" },
        warning: { DEFAULT: "var(--warning)", soft: "var(--warning-soft)" },
        danger: { DEFAULT: "var(--danger)", soft: "var(--danger-soft)" },
        info: { DEFAULT: "var(--info)", soft: "var(--info-soft)" },
      },
      borderRadius: { token: "var(--radius-md)", card: "var(--radius-lg)" },
      boxShadow: { "token-sm": "var(--shadow-sm)", "token-md": "var(--shadow-md)", "token-lg": "var(--shadow-lg)" },
    },
  },
  plugins: [],
};
