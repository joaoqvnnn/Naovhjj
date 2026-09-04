/**
 * Normaliza um número de telefone/WhatsApp para o formato internacional:
 * 55 + DDD + número (ex: 5544999999999)
 * Aceita vários formatos de entrada, incluindo:
 *  - +55 (44) 99999-9999
 *  - 5544999999999
 *  - 44999999999 (sem código do país)
 *  - (44) 99999-9999
 *  - 44 99999-9999
 *  - 55 44 99999-9999
 *  - +55 44 99999 9999
 */
export function normalizePhone(input: string): string | null {
  // Remove todos os caracteres não numéricos
  let digits = input.replace(/\D/g, '');

  // Se começar com 0, remove (DDD nacional às vezes é escrito com 0 na frente)
  if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }

  // Se já começar com 55, garante que tenha DDD + número (10 ou 11 dígitos após 55)
  if (digits.startsWith('55')) {
    const rest = digits.substring(2);
    if (rest.length === 10 || rest.length === 11) {
      return '55' + rest;
    }
  }

  // Se não começar com 55, assume que é número nacional (DDD + número)
  if (digits.length === 10 || digits.length === 11) {
    // Adiciona código do país 55
    return '55' + digits;
  }

  // Caso o número tenha 12 ou 13 dígitos e comece com 55 (já com código)
  if (digits.length === 12 || digits.length === 13) {
    if (digits.startsWith('55')) {
      return digits;
    }
  }

  return null; // inválido
}

/**
 * Valida se o número de telefone é válido (após normalização).
 */
export function isValidPhone(input: string): boolean {
  return normalizePhone(input) !== null;
}
