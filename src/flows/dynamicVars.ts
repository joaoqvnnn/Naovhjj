export function replaceVars(text: string, vars: Record<string, any>): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    return vars[key] !== undefined ? String(vars[key]) : match;
  });
}

// Exemplo:
// const msg = "Olá {nome}, seu saldo é {saldo}";
// const resultado = replaceVars(msg, { nome: "João", saldo: "R$ 10,00" });
// resultado: "Olá João, seu saldo é R$ 10,00"
