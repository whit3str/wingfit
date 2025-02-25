/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit", // Ensure JIT mode is enabled
  darkMode: "selector",
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {},
  },
  plugins: [require("tailwindcss-primeui")],
};
