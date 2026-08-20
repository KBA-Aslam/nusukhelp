/**
 * DOM matchers for the component tests.
 *
 * Loaded for every suite; in the `node` environment it only extends `expect`
 * and is never called, so the D1 tests carry no DOM at all.
 */
import '@testing-library/jest-dom/vitest';
