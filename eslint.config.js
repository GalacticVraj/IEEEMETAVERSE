// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Framework packages the PURE layers (kernel + simulation domain) must never
 * import. Enforces "the simulation compiles if React / Three / UI are deleted".
 */
const FRAMEWORK_PACKAGES = [
  'react',
  'react-dom',
  'react-dom/*',
  'three',
  'three/*',
  '@react-three/fiber',
  '@react-three/drei',
  '@react-three/postprocessing',
  'gsap',
  '@gsap/*',
  'howler',
  'zustand',
  'zustand/*',
];

/**
 * Consumer / composition-only aliases the pure layers must never import. The
 * dependency arrow only ever points DOWN, toward `core`.
 */
const CONSUMER_ALIASES = [
  '@rendering',
  '@rendering/*',
  '@ui',
  '@ui/*',
  '@audio',
  '@audio/*',
  '@state',
  '@state/*',
  '@debug',
  '@debug/*',
  '@infra',
  '@infra/*',
  '@config',
  '@config/*',
];

/** Glob set for every pure layer (kernel + simulation domain + shared pure helpers). */
const PURE_LAYER_GLOBS = [
  'src/core/**/*.ts',
  'src/kernel/**/*.ts',
  'src/engine/**/*.ts',
  'src/scenarios/**/*.ts',
  'src/learning/**/*.ts',
  'src/ethics/**/*.ts',
  'src/replay/**/*.ts',
  'src/utils/**/*.ts',
  'src/constants/**/*.ts',
  'src/types/**/*.ts',
];

/** Engine core must not depend on the scenario plugin layer (open/closed). */
const ENGINE_CORE_GLOBS = ['src/core/**/*.ts', 'src/kernel/**/*.ts', 'src/engine/**/*.ts'];

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', '**/*.config.js', '.husky'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, ...globals.es2022 },
    },
  },

  // ---- Project-wide rules ---------------------------------------------------
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Placeholders throw synchronously inside async signatures during Phase 1.
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-magic-numbers': [
        'warn',
        {
          ignore: [0, 1, -1, 2, 100, 1000],
          ignoreEnums: true,
          ignoreReadonlyClassProperties: true,
          ignoreArrayIndexes: true,
          enforceConst: true,
          detectObjects: false,
        },
      ],
      'no-console': 'warn',
      eqeqeq: ['error', 'always'],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message:
            'Default exports are banned (barrel-friendly named exports only). Use a named export.',
        },
      ],
    },
  },

  // ---- React (only .tsx presentation/UI) ------------------------------------
  {
    files: ['src/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // React component files legitimately use default-free named exports too,
      // but framework entry points may need a default — allow it narrowly.
      'no-restricted-syntax': 'off',
    },
  },

  // ---- Boundary: pure layers may not import frameworks or consumers ---------
  {
    files: PURE_LAYER_GLOBS,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: FRAMEWORK_PACKAGES,
              message:
                'Pure simulation layers must not import UI frameworks. The engine must compile with React/Three deleted.',
            },
            {
              group: CONSUMER_ALIASES,
              message:
                'Pure layers must not import consumer/composition modules. Dependencies point DOWN toward @core only.',
            },
          ],
        },
      ],
    },
  },

  // ---- Boundary: engine core must not import the scenario plugin layer ------
  {
    files: ENGINE_CORE_GLOBS,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [...FRAMEWORK_PACKAGES, ...CONSUMER_ALIASES, '@scenarios', '@scenarios/*'],
              message:
                'Engine core is closed for modification: scenarios depend on the engine, never the reverse.',
            },
          ],
        },
      ],
    },
  },

  // ---- Build config files must default-export (Vite/Vitest contract) --------
  {
    files: ['*.config.ts', 'vite.config.ts', 'vitest.config.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },

  // ---- Tests relax numeric/logging ergonomics -------------------------------
  {
    files: ['**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  prettier,
);
