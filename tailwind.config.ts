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
        primary: "#a98467",
        secondary: "#C5D791",
        accent: "#A3B86A",
        dark: "#6c584c",
        background: "#E6DFC4",
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
            primary: { DEFAULT: "#a98467" },
            secondary: { DEFAULT: "#dde5b6" },
            success: { DEFAULT: "#adc178" },
            background: { DEFAULT: "#D9D2B4" },
            // dark: { DEFAULT: "#6c584c" },
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
