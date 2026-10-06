/**
 * Public entry point of the Mean Chess rules engine.
 *
 * The engine is pure, deterministic TypeScript with no React or DOM dependencies
 * (enforced by eslint.config.js). Everything outside src/engine imports from here only.
 */

/** Version of the written rules (docs/RULES.md) that this engine implements. */
export const RULES_VERSION = '0.1'
