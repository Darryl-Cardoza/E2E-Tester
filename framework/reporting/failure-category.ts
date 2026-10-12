/**
 * Failure categories, in the order the reports present them:
 * - assertion: the product behaved differently from the test expectation
 * - invalid-definition: the YAML or its variables cannot be executed as written
 * - infrastructure: the environment, network or a required service was unavailable
 * - setup-cleanup: owned test data could not be created or removed
 */
export type FailureCategory =
  'assertion' | 'invalid-definition' | 'infrastructure' | 'setup-cleanup';

export class CategorizedError extends Error {
  constructor(
    readonly category: FailureCategory,
    message: string,
  ) {
    super(`[${category}] ${message}`);
    this.name = 'CategorizedError';
  }
}

/**
 * Playwright matcher failures carry matcherResult and are product assertions. Any other
 * runtime failure (timeouts, refused connections, unavailable services) is environmental.
 */
export function categorizeFailure(error: unknown): FailureCategory {
  if (error instanceof CategorizedError) return error.category;
  if (error !== null && typeof error === 'object' && 'matcherResult' in error) return 'assertion';
  return 'infrastructure';
}
