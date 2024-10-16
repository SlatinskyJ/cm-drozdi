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
        primary: "#977351",
        secondary: "#CADC99",
        accent: "#ACC270",
        dark: "#5D4435",
        background: "#E6DFC4",
        white: "#e2e8f0",
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
        content1: "#FAF8E8",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", ...fontFamily.sans],
      },
    },
  },
  darkMode: "class",
  plugins: [
    nextui({
      themes: {
        dark: {
          colors: {
            primary: { DEFAULT: "#977351" },
            secondary: { DEFAULT: "#CADC99" },
            success: { DEFAULT: "#ACC270" },
            background: { DEFAULT: "#E6DFC4" },
          },
        },
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
