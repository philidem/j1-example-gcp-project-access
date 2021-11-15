module.exports = {
  '*.{ts,tsx,js,jsx,json,css,md}': [
    'prettier --write',
    'yarn rewrite-imports --dir .',
  ],
};
