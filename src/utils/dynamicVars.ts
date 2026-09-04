// Substitui variáveis dinâmicas em um texto
export function replaceDynamicVars(text: string, vars: Record<string, any>): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    if (vars[key] !== undefined) {
      return String(vars[key]);
    }
    return match; // mantém a variável se não encontrada
  });
}

// Exemplos de uso:
// const texto = 'Saldo: {saldo} | Preço: {preco}';
// const resultado = replaceDynamicVars(texto, { saldo: 'R$ 10,00', preco: 'R$ 5,00' });
// resultado: 'Saldo: R$ 10,00 | Preço: R$ 5,00'
