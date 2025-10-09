module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        violent: '#ef4444',
        property: '#f97316',
        traffic: '#3b82f6',
        other: '#10b981'
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: 0.8, transform: 'scale(1)' },
          '50%': { opacity: 0.4, transform: 'scale(1.2)' }
        }
      },
      animation: {
        pulseGlow: 'pulseGlow 3s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
