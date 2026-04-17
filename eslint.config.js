import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import globals from 'globals'

// tseslint.config is deprecated in favor of ESLint's defineConfig, but ESLint 9.39 does
// not expose defineConfig as a named ESM export. Safe to disable until ESLint ships it.
// eslint-disable-next-line @typescript-eslint/no-deprecated
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/lib/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/node_modules/**',
      'infra/terraform/**',
      '**/.firebase/**',
    ],
  },

  // JS + TS baseline
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Global settings for TS projects
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // TODO(phase-2): enable @typescript-eslint/no-unsafe-assignment
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
      'no-console': ['error', { allow: ['error', 'warn'] }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='doc'] TemplateLiteral",
          message:
            "Don't build Firestore paths with template literals. Use doc() with validated IDs.",
        },
      ],
    },
  },

  // React apps + shared-ui
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/shared-ui/**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
    },
    settings: { react: { version: '18.3' } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // React 17+ JSX transform
      'react/prop-types': 'off', // TypeScript handles it
    },
  },

  // Accessibility — apps only
  {
    files: ['apps/**/*.{ts,tsx}'],
    plugins: { 'jsx-a11y': jsxA11y },
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    rules: jsxA11y.configs.recommended.rules,
  },

  // Node env — functions + shared-sms-parser + shared-validators
  {
    files: [
      'functions/**/*.ts',
      'packages/shared-sms-parser/**/*.ts',
      'packages/shared-validators/**/*.ts',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Test files — allow console, relax return types
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/test/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // Config files themselves (this file + vite configs)
  // Ignores vitest.config.ts files (TypeScript project-service boundary issue)
  {
    ignores: ['vitest.config.ts', '**/vitest.config.ts'],
  },
  {
    files: ['**/*.config.{js,ts}', '**/*.config.cjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
)
