import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';
import { PERFORMANCE_BUDGETS } from './budget.config';

describe('Performance Budgets', () => {
  const distPath = resolve(__dirname, '../../dist/assets');

  describe('Bundle Size', () => {
    it('should keep main bundle under 500KB', () => {
      // Skip test if dist doesn't exist (e.g., in CI before build)
      if (!existsSync(distPath)) {
        console.warn('Dist directory not found, skipping bundle size test');
        return;
      }

      const jsFiles = readdirSync(distPath).filter((f) =>
        f.match(/^index-[a-f0-9]+\.js$/)
      );

      expect(jsFiles.length).toBeGreaterThan(0);

      const mainJsPath = resolve(distPath, jsFiles[0]);
      const size = statSync(mainJsPath).size;

      expect(size).toBeLessThan(PERFORMANCE_BUDGETS.bundleSize);
    });

    it('should keep total JS under 1MB', () => {
      if (!existsSync(distPath)) {
        console.warn('Dist directory not found, skipping bundle size test');
        return;
      }

      const jsFiles = readdirSync(distPath).filter((f) =>
        f.endsWith('.js')
      );

      let totalSize = 0;
      for (const file of jsFiles) {
        totalSize += statSync(resolve(distPath, file)).size;
      }

      expect(totalSize).toBeLessThan(PERFORMANCE_BUDGETS.totalJs);
    });
  });

  describe('Build Artifacts', () => {
    it('should have index.html after running build', () => {
      const distPath = resolve(__dirname, '../../dist');

      // Skip test if dist doesn't exist (e.g., in CI before build)
      if (!existsSync(distPath)) {
        console.warn('Dist directory not found, skipping build artifacts test');
        return;
      }

      const indexHtmlExists = existsSync(resolve(distPath, 'index.html'));

      expect(indexHtmlExists).toBe(true);
    });

    it('should generate JS bundles with hashes in filenames', () => {
      if (!existsSync(distPath)) {
        console.warn('Dist directory not found, skipping bundle test');
        return;
      }

      const jsFiles = readdirSync(distPath).filter((f) => f.endsWith('.js'));

      // Vite generates hashed filenames like index-[hash].js
      expect(jsFiles.length).toBeGreaterThan(0);
      expect(jsFiles[0]).toMatch(/index-[a-f0-9]+\.js/);
    });
  });
});
