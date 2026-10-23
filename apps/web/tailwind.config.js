/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        obligon: {
          navy: "#00010c",
          blue: "#011554",
          green: "#3d6a00",
          lime: "#aaf857",
          mist: "#f6f8fa",
          panel: "#f0f4f7",
          border: "#dde3e8",
          text: "#454650"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
        display: ["var(--font-plus-jakarta)", "Plus Jakarta Sans", "sans-serif"]
      },
      boxShadow: {
        green: "0 1px 2px rgba(29,47,12,0.08)",
        card: "0 2px 8px -4px rgba(17,24,39,0.12)",
        hero: "0 24px 64px -24px rgba(0,1,12,0.26)"
      },
      maxWidth: {
        landing: "1152px"
      }
    }
  },
  plugins: []
};
