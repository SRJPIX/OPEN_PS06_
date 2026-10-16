import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env before validating
dotenv.config();

export const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required')
    .default('mongodb://localhost:27017/evidra'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters long')
    .default('super_secret_jwt_key_that_is_at_least_32_characters_long_for_dev'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Optional AI Provider Variables (Backend runs even if absent)
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates provided environment variables or process.env.
 * Throws a formatted Error with issues if validation fails.
 */
export const validateEnv = (envToValidate: NodeJS.ProcessEnv = process.env): EnvConfig => {
  const result = envSchema.safeParse(envToValidate);

  if (!result.success) {
    const errorMessages = result.error.issues
      .map((issue) => `  - [${issue.path.join('.')}]: ${issue.message}`)
      .join('\n');
    throw new Error(
      `[Configuration Error] Environment variable validation failed:\n${errorMessages}`
    );
  }

  // Enforce stricter checks in production
  if (result.data.NODE_ENV === 'production') {
    if (result.data.MONGODB_URI.includes('localhost')) {
      throw new Error(
        '[Configuration Error] MONGODB_URI cannot point to localhost in production mode.'
      );
    }
    if (result.data.JWT_SECRET.includes('super_secret_jwt_key_that_is_at_least_32')) {
      throw new Error(
        '[Configuration Error] Production JWT_SECRET cannot use the default placeholder.'
      );
    }
  }

  return result.data;
};

// Singleton validated config for application runtime
export const config: EnvConfig = validateEnv(process.env);
