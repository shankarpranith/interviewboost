import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    // Keeping src just in case you add it later!
    "./src/**/*.{js,ts,jsx,tsx,mdx}", 
  ],
  theme: {
    extend: {
      colors: {
        // Futuristic Dark Theme Palette
        'dark-bg': '#0D0F16',
        'card-bg': 'rgba(19, 23, 33, 0.7)',
        'accent-blue': '#3B82F6', // Blue 500
        'accent-purple': '#8B5CF6', // Purple 500
        'glow-blue': 'rgba(59, 130, 246, 0.3)',
        'glow-purple': 'rgba(139, 92, 246, 0.3)',
        'text-primary': '#E2E8F0',
        'text-secondary': '#94A3B8',
        'border-glass': 'rgba(255, 255, 255, 0.08)',
      },
      backgroundImage: {
        'gradient-futuristic': 'linear-gradient(135deg, #111421 0%, #0D0F16 100%)',
        'gradient-accent': 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.2)',
        'glow-blue': '0 0 15px 2px rgba(59, 130, 246, 0.5)',
        'glow-purple': '0 0 15px 2px rgba(139, 92, 246, 0.5)',
      },
      backdropBlur: {
        'glass': '12px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'), // ADD THIS LINE!
  ],
};
export default config;