export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);

  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) {
    return false;
  }

  const calculateDigit = (base: string, weights: number[]): number => {
    const sum = weights.reduce((total, weight, index) => {
      return total + Number(base[index]) * weight;
    }, 0);
    const remainder = sum % 11;

    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateDigit(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return cnpj.endsWith(`${firstDigit}${secondDigit}`);
}
