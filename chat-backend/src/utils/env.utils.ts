/**
 * Resolve environment variable substitution
 * Example: ${SERVER_PORT} -> 3001
 */
export function resolveEnvVars(value: string | undefined): string {
  if (!value) return '';
  return value.replace(/\$\{([^}]+)\}/g, (match: string, varName: string) => {
    return process.env[varName] || match;
  });
}

/**
 * Get environment variable with fallback and variable substitution
 */
export function getEnvVar(key: string, fallback: string): string {
  const value = process.env[key];
  return value ? resolveEnvVars(value) : fallback;
}
