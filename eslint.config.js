// eslint.config.js — ESLint v9 flat config
export default [
  {
    files: ['server.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        setTimeout: 'readonly',
        fetch: 'readonly',
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
    }
  },
  {
    files: ['public/script.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        SpeechSynthesisUtterance: 'readonly',
        localStorage: 'readonly',
      }
    },
    rules: {
      'no-unused-vars': 'warn',
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
    }
  }
];
