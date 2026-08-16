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
          mist: "#f9f9ff",
          panel: "#eff3ff",
          border: "#c6c5d1",
          text: "#454650"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
        display: ["var(--font-plus-jakarta)", "Plus Jakarta Sans", "sans-serif"]
      },
      boxShadow: {
        green: "0 10px 15px -3px rgba(61,106,0,0.2), 0 4px 6px -4px rgba(61,106,0,0.2)",
        card: "0 20px 25px -5px rgba(0,0,0,0.10), 0 8px 10px -6px rgba(0,0,0,0.10)",
        hero: "0 50px 100px -20px rgba(0,0,0,0.60)"
      },
      maxWidth: {
        landing: "1152px"
      }
    }
  },
  plugins: []
};
