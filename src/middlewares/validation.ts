export function isValidPhone(phone: string): boolean {
  return /^\d{10,13}$/.test(phone.replace(/\D/g, ''));
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPixKey(key: string): boolean {
  return key.length > 3;
}

export function isValidAgency(agency: string): boolean {
  return /^\d{1,4}$/.test(agency.replace(/\D/g, ''));
}

export function isValidAccount(account: string): boolean {
  return /^\d{1,12}$/.test(account.replace(/\D/g, ''));
}
