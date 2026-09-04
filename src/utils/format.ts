// Formata um número como moeda brasileira
export function formatCurrency(value: number | string | Decimal): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Formata data no padrão brasileiro
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

// Formata hora no padrão brasileiro
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Formata data e hora juntas
export function formatDateTime(date: Date | string): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

// Converte string de número com vírgula para float
export function parseDecimal(value: string): number {
  return parseFloat(value.replace(/\./g, '').replace(',', '.'));
}

// Valida e normaliza número de WhatsApp (formato brasileiro)
export function normalizeWhatsApp(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    // Adiciona DDI 55 se não tiver
    if (!digits.startsWith('55')) digits = '55' + digits;
    return digits;
  }
  if (digits.length === 12 || digits.length === 13) {
    if (digits.startsWith('55')) return digits;
  }
  return null;
}

// Valida e-mail simples
export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Valida chave Pix (CPF, CNPJ, e-mail, telefone, aleatória)
export function isValidPixKey(key: string): boolean {
  // Remove espaços
  const k = key.trim();
  if (isValidEmail(k)) return true;
  if (/^\d{11}$/.test(k)) return true; // CPF
  if (/^\d{14}$/.test(k)) return true; // CNPJ
  if (/^\+\d{10,15}$/.test(k)) return true; // telefone com + e DDI
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return true; // UUID
  // Chave aleatória (pode ser qualquer string)
  if (k.length >= 5 && k.length <= 77) return true;
  return false;
}

// Gera string aleatória para códigos
export function generateRandomCode(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Formata número com casas decimais para exibição
export function formatDecimal(value: number, decimals = 2): string {
  return value.toFixed(decimals);
}

// Converte timestamp para objeto Date
export function toDate(timestamp: number): Date {
  return new Date(timestamp);
}
