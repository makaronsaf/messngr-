/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Telegram-like color palette
        tg: {
          blue: '#2AABEE',
          'blue-dark': '#229ED9',
          'blue-light': '#5BC8F5',
          green: '#4FAE4E',
          'green-light': '#C8E6C9',
          red: '#E53935',
          orange: '#FF9800',
          purple: '#7B1FA2',
          bg: '#FFFFFF',
          'bg-secondary': '#F4F4F5',
          sidebar: '#2B2B2B',
          'sidebar-hover': '#3A3A3A',
          'chat-bg': '#EFEBE0',
          'msg-out': '#EFFDDE',
          'msg-in': '#FFFFFF',
          'msg-out-dark': '#2B5278',
          'msg-in-dark': '#182533',
          header: '#527DA3',
          text: '#000000',
          'text-secondary': '#707579',
          'text-hint': '#A0A0A0',
          divider: '#E4E4E6',
          'online-dot': '#4CAF50',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      animation: {
        'slide-in-right': 'slideInRight 0.2s ease-out',
        'slide-in-left': 'slideInLeft 0.2s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out',
        'bounce-in': 'bounceIn 0.3s ease-out',
        'pulse-dot': 'pulseDot 2s infinite',
      },
      keyframes: {
        slideInRight: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        slideInLeft: {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.1)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      boxShadow: {
        'msg': '0 1px 2px rgba(0,0,0,0.15)',
        'panel': '0 2px 8px rgba(0,0,0,0.15)',
        'modal': '0 20px 60px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
};
