const cssVar = (name) => `rgb(var(${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: cssVar("--c-paper"),
        ink: cssVar("--c-ink"),
        "ink-soft": cssVar("--c-ink-soft"),
        surface: cssVar("--c-surface"),
        "line-soft": cssVar("--c-line-soft"),
        line: cssVar("--c-line"),
        "line-strong": cssVar("--c-line-strong"),
        muted: cssVar("--c-muted"),
        "muted-soft": cssVar("--c-muted-soft"),
        primary: cssVar("--c-primary"),
        "primary-700": cssVar("--c-primary-700"),
        "primary-800": cssVar("--c-primary-800"),
        mint: cssVar("--c-mint"),
        danger: cssVar("--c-danger"),
        "danger-700": cssVar("--c-danger-700"),
        accent: cssVar("--c-accent"),
        "accent-700": cssVar("--c-accent-700"),
        violet: cssVar("--c-violet"),
        "violet-700": cssVar("--c-violet-700"),
      },
    },
  },
  plugins: [],
};
