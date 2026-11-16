import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        obsidian: {
          DEFAULT: "#0b0e17",
          light: "#131927",
          elevated: "#1a2236"
        },
        hextech: {
          gold: "#f59e0b",
          "gold-light": "#fbbf24",
          cyan: "#06b6d4",
          "cyan-light": "#38bdf8",
          purple: "#8b5cf6",
          "purple-light": "#c084fc",
          rose: "#f43f5e"
        },
        atlas: {
          bg: "#0b0e17",
          paper: "#131927",
          soft: "#1a2236",
          ink: "#f8fafc",
          dim: "#94a3b8",
          line: "#242f49",
          brand: "#06b6d4",
          on: "#083344",
          wash: "#0e3b43",
          gold: "#f59e0b",
          red: "#f43f5e",
          redwash: "#3b1722",
          hero: "#0f172a",
          herotxt: "#f8fafc",
          heromuted: "#94a3b8"
        },
        cost: {
          1: "#94a3b8",
          2: "#10b981",
          3: "#06b6d4",
          4: "#a855f7",
          5: "#f59e0b"
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        buff: {
          DEFAULT: "#10b981",
          light: "rgba(16, 185, 129, 0.15)"
        },
        nerf: {
          DEFAULT: "#f43f5e",
          light: "rgba(244, 63, 94, 0.15)"
        },
        neutral: {
          DEFAULT: "#94a3b8",
          light: "rgba(148, 163, 184, 0.15)"
        },
        mixed: {
          DEFAULT: "#f59e0b",
          light: "rgba(245, 158, 11, 0.15)"
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      }
    }
  },
  plugins: []
};

export default config;
