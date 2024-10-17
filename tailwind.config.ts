import { nextui } from "@nextui-org/theme";
import { type Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

export default {
  content: [
    "./src/**/*.tsx",
    "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#9c7243",
        secondary: "#bdd086",
        accent: "#85a042",
        dark: "#5a3d2d",
        background: "#E6DFC4",
        white: "#FAF8E8",
        danger: "#ed5122",
        default: {
          50: "#FAF8E8",
          100: "#e6dfc4",
          200: "#dcd2ab",
          300: "#c9b880",
          400: "#bda262",
          500: "#b18c4f",
          600: "#9c7243",
          700: "#825a3b",
          800: "#6c4934",
          900: "#5a3d2d",
        },
        green: {
          "50": "#f6f8ed",
          "100": "#ebf0d7",
          "200": "#d7e3b3",
          "300": "#bdd086",
          "400": "#acc270",
          "500": "#85a042",
          "600": "#687f31",
          "700": "#4f6229",
          "800": "#424f25",
          "900": "#394423",
          "950": "#1c240f",
        },
        orange: {
          "50": "#fef4ee",
          "100": "#fde6d7",
          "200": "#facaae",
          "300": "#f6a67e",
          "400": "#f17546",
          "500": "#ed5122",
          "600": "#de3918",
          "700": "#b82816",
          "800": "#932219",
          "900": "#761f18",
          "950": "#400c0a",
        },
        content1: "#FAF8E8",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", ...fontFamily.sans],
        pacifico: ["var(--font-pacifico)"],
      },
    },
  },
  darkMode: "class",
  plugins: [
    nextui({
      themes: {
        dark: {},
      },
      layout: {
        radius: {
          small: "2px",
          medium: "4px",
          large: "8px",
        },
      },
    }),
  ],
} satisfies Config;
