import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages는 https://<user>.github.io/<repo>/ 경로에서 서비스되므로 base 설정 필요
export default defineConfig({
  base: '/pixel-art/',
  plugins: [react()],
});
