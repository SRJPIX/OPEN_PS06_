import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'dist/',
      '**/dist/**',
      'node_modules/',
      '**/node_modules/**',
      'build/',
      '**/build/**',
      'coverage/',
      '*.config.js',
      '*.config.mjs',
      '*.config.ts',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
);
