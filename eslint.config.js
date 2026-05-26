// ESLint flat config (v9). Type-aware rules via typescript-eslint,
// scoped to src/. Prettier owns formatting; ESLint stays out of
// stylistic concerns.
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'data/**'],
  },
  // Type-aware linting only on source TS files.
  {
    files: ['src/**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // Plain JS config files: no type-aware linting.
  {
    files: ['*.js', '*.mjs', '*.cjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  // Must come last so Prettier wins on stylistic conflicts.
  prettier,
);
