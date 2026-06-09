/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 라이트 모드 시맨틱 토큰
        ink: '#eef0f3', // 앱 배경
        panel: '#ffffff', // 패널 배경
        panel2: '#f3f4f7', // 보조 패널/입력 배경
        line: '#d9dce3', // 테두리
        accent: '#22c3bc', // 키컬러(틸)
        accentDark: '#179d97', // hover/pressed
        onAccent: '#06302e', // accent 위 글자(대비 확보용 진한 색)
        // text-gray-* 램프를 라이트 모드용으로 반전(어두운 텍스트)
        gray: {
          100: '#111827',
          200: '#1f2937',
          300: '#374151',
          400: '#5b6470',
          500: '#8b93a1',
          600: '#aab0bb',
          700: '#c3c8d0',
          800: '#dfe2e8',
          900: '#eef0f3',
        },
      },
    },
  },
  plugins: [],
};
