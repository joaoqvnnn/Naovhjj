import prisma from '../database';
import { logAction } from './logger';

// Obtém configuração de bônus de recarga
async function getRechargeBonusConfig() {
  const setting = await prisma.setting.findUnique({ where: { key: 'bonus_recharge' } });
  if (!setting) return { percentage: 0, enabled: false };
  const value = parseFloat(setting.value.toString());
  return { percentage: value, enabled: value > 0 };
}

// Obtém configuração de bônus de registro
async function getRegisterBonusConfig() {
  const setting = await prisma.setting.findUnique({ where: { key: 'bonus_register' } });
  if (!setting) return { amount: 0, enabled: false };
  const value = parseFloat(setting.value.toString());
  return { amount: value, enabled: value > 0 };
}

// Aplica bônus de recarga após pagamento aprovado
// Deve ser chamado dentro da transação que credita o saldo
export async function applyRechargeBonus(userId: number, rechargeAmount: number): Promise<number> {
  const config = await getRechargeBonusConfig();
  if (!config.enabled) return 0;

  const bonus = (rechargeAmount * config.percentage) / 100;
  if (bonus > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: bonus } },
    });
    await logAction({
      action: 'RECHARGE_BONUS_CREDITED',
      userId,
      details: { rechargeAmount, bonus, percentage: config.percentage },
    });
  }
  return bonus;
}

// Aplica bônus de registro quando um novo usuário é criado
export async function applyRegisterBonus(userId: number): Promise<number> {
  const config = await getRegisterBonusConfig();
  if (!config.enabled || config.amount <= 0) return 0;

  await prisma.user.update({
    where: { id: userId },
    data: { balance: { increment: config.amount } },
  });
  await logAction({
    action: 'REGISTER_BONUS_CREDITED',
    userId,
    details: { amount: config.amount },
  });
  return config.amount;
}
