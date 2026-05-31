import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Logica pura del parser (turni-parser.js): niente DOM, Node basta ed è più veloce.
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
