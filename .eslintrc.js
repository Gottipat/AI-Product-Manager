module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint', 'import'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'plugin:import/recommended',
        'plugin:import/typescript',
        'prettier',
    ],
    env: {
        node: true,
        es2022: true,
    },
    settings: {
        'import/resolver': {
            typescript: {
                project: ['./tsconfig.base.json', './packages/*/tsconfig.json'],
            },
        },
    },
    rules: {
        '@typescript-eslint/explicit-function-return-type': 'warn',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/prefer-nullish-coalescing': 'error',
        '@typescript-eslint/prefer-optional-chain': 'error',
        'import/order': [
            'error',
            {
                groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
                'newlines-between': 'always',
                alphabetize: { order: 'asc', caseInsensitive: true },
            },
        ],
        'import/no-duplicates': 'error',
        'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
    overrides: [
        {
            files: ['*.test.ts', '*.spec.ts'],
            rules: {
                '@typescript-eslint/no-explicit-any': 'off',
            },
        },
    ],
    ignorePatterns: ['node_modules', 'dist', 'build', '*.js', '!.eslintrc.js'],
};
