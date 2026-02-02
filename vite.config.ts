
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // SECURE MODE: Do NOT expose API_KEY to client.
  // The app must rely on Cloud Functions (geminiGateway) for AI calls.
  const safeEnv = {
    ...env,
    // API_KEY is intentionally omitted here.
    VITE_FIREBASE_API_KEY: env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET: env.VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID: env.VITE_FIREBASE_APP_ID
  };

  return {
    publicDir: false, 
    optimizeDeps: {
      exclude: ['pdfjs-dist'] // Prevent Vite from pre-bundling this
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        external: ['pdfjs-dist'] // Don't bundle, use Import Map at runtime
      }
    },
    plugins: [react()],
    define: {
      'process.env': JSON.stringify(safeEnv)
    }
  };
});
