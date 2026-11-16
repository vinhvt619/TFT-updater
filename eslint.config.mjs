import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
// Resolve the same compat dependency as ESLint; supports pnpm optional-peer layouts.
const {FlatCompat}=createRequire(require.resolve('eslint/package.json'))('@eslint/eslintrc');
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const compat=new FlatCompat({baseDirectory:path.dirname(fileURLToPath(import.meta.url))});
export default [
 {ignores:['.next/**','.next*/**','node_modules/**','storage/**','dist/**','.cache/**','artifacts/**','next-env.d.ts','test-results/**','playwright-report/**']},
 {files:['**/*.cjs','eslint.config.mjs'],rules:{'@typescript-eslint/no-require-imports':'off'}},
 ...compat.extends('next/core-web-vitals','next/typescript'),
 {files:['**/*.cjs','eslint.config.mjs'],rules:{'@typescript-eslint/no-require-imports':'off'}},
 {rules:{'@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-vars':'warn','@next/next/no-img-element':'off','react-hooks/exhaustive-deps':'warn'}}
];
