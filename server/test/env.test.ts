import { describe, it, expect } from 'vitest';
import { validateEnv } from '../src/config/env';

describe('Environment Configuration Validation', () => {
  const validBaseEnv = {
    PORT: '5000',
    NODE_ENV: 'test',
    CLIENT_URL: 'http://localhost:5173',
    MONGODB_URI: 'mongodb://localhost:27017/evidra_test',
    JWT_SECRET: 'this_is_a_very_long_test_jwt_secret_with_more_than_32_characters',
    JWT_EXPIRES_IN: '7d',
  };

  it('should validate valid environment configuration successfully', () => {
    const config = validateEnv(validBaseEnv);
    expect(config.PORT).toBe(5000);
    expect(config.NODE_ENV).toBe('test');
    expect(config.CLIENT_URL).toBe('http://localhost:5173');
    expect(config.MONGODB_URI).toBe('mongodb://localhost:27017/evidra_test');
    expect(config.JWT_SECRET).toBe(
      'this_is_a_very_long_test_jwt_secret_with_more_than_32_characters'
    );
  });

  it('should allow optional AI variables to be absent without failure', () => {
    const config = validateEnv(validBaseEnv);
    expect(config.GEMINI_API_KEY).toBeUndefined();
    expect(config.OPENAI_API_KEY).toBeUndefined();
    expect(config.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it('should reject JWT_SECRET if shorter than 32 characters', () => {
    const invalidEnv = {
      ...validBaseEnv,
      JWT_SECRET: 'too_short',
    };

    expect(() => validateEnv(invalidEnv)).toThrowError(/JWT_SECRET must be at least 32 characters/);
  });

  it('should reject invalid NODE_ENV', () => {
    const invalidEnv = {
      ...validBaseEnv,
      NODE_ENV: 'invalid_env_name',
    };

    expect(() => validateEnv(invalidEnv as unknown as NodeJS.ProcessEnv)).toThrowError(
      /Environment variable validation failed/
    );
  });

  it('should enforce production restrictions on MONGODB_URI', () => {
    const prodEnvWithLocalhost = {
      ...validBaseEnv,
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://localhost:27017/evidra_prod',
      JWT_SECRET: 'a_custom_production_jwt_secret_that_is_32_chars_or_longer',
    };

    expect(() => validateEnv(prodEnvWithLocalhost)).toThrowError(
      /MONGODB_URI cannot point to localhost in production mode/
    );
  });

  it('should enforce production restrictions on placeholder JWT_SECRET', () => {
    const prodEnvWithPlaceholder = {
      ...validBaseEnv,
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb+srv://admin:pass@cluster.mongodb.net/evidra',
      JWT_SECRET: 'super_secret_jwt_key_that_is_at_least_32_characters_long_for_dev',
    };

    expect(() => validateEnv(prodEnvWithPlaceholder)).toThrowError(
      /Production JWT_SECRET cannot use the default placeholder/
    );
  });
});
