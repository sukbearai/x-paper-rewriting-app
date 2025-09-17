import antfu from '@antfu/eslint-config'

export default antfu(
  {
    rules: {
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'node/prefer-global/process': 'off',
      'no-console': 'off',
    },
  },
  {
    ignores: [
      '**/components/ui/**',
    ],
  },
)
