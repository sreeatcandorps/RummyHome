// node --import entry: registers stubs for React Native / Expo modules so services/*.ts
// load under plain Node. registerHooks covers both ESM import and CJS require (tsx output).
import { registerHooks } from 'node:module';
import { STUBS } from './stub-loader.mjs';

registerHooks({
  resolve(specifier, context, next) {
    if (STUBS[specifier]) return { url: 'stub:' + specifier, shortCircuit: true, format: 'module' };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('stub:')) return { format: 'module', source: STUBS[url.slice(5)], shortCircuit: true };
    return next(url, context);
  },
});
