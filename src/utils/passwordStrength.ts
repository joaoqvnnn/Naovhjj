export interface PasswordPolicy {
  minLength: number;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  requireUpperCase: boolean;
}

const DEFAULT_POLICY: PasswordPolicy = {
  minLength: 6,
  requireNumbers: false,
  requireSpecialChars: false,
  requireUpperCase: false,
};

export function validatePasswordStrength(password: string, policy: PasswordPolicy = DEFAULT_POLICY): string | null {
  if (password.length < policy.minLength) {
    return `A senha deve ter pelo menos ${policy.minLength} caracteres.`;
  }
  if (policy.requireNumbers && !/\d/.test(password)) {
    return 'A senha deve conter pelo menos um número.';
  }
  if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return 'A senha deve conter pelo menos um caractere especial.';
  }
  if (policy.requireUpperCase && !/[A-Z]/.test(password)) {
    return 'A senha deve conter pelo menos uma letra maiúscula.';
  }
  return null;
}
