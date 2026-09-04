import { Context } from '../types/context';
import { showConfigMenu, showActionsMenu, showTransactionsMenu, showUpdatesMenu, showAdminDashboard } from './adminMenu';
import { showGeneralConfig, setSupport, setSeparator, setLogDestination, toggleMaintenance, restartBot } from './generalConfig';
import { listAdmins, addAdmin, removeAdmin } from './adminActions';
import { showAffiliateConfig, toggleAffiliateSystem, setAffiliatePoints, setAffiliateMin, setAffiliateMultiplier } from './affiliateConfig';
import { showPixConfig, togglePixMode, setManualPixKey, toggleQrCode, toggleCopyButton, setExpiration, setMinAmount, setMaxAmount, editPixMessage } from './pixConfig';
import { showLoginsPanel, addLogins, removeLogin, removeByPlatform, zeroStock, detailedStock, changeServicePrice, changeAllPrices } from './loginsStock';
import { showResearchConfig, addResearchImage, removeResearchImage } from './researchConfig';
import { showTemplateList, viewTemplate, editTemplateText, editTemplateImage, resetTemplate } from './templateEditor';
import { showButtonList, viewButtonConfig, addButton, editButton, removeButton, reorderButtons, resetButtons } from './buttonEditorFull';
import { showBroadcastMenuWithButtons, startBroadcastText, showButtonOptions, addBuyButton, addBalanceButton, addRegisterButton, addSupportButton, addLinkButton, sendBroadcastWithButtons } from './broadcastWithButtons';
import { showAntifloodConfig, setAntifloodParam } from './antifloodConfig';
import { showNotificationConfig, toggleNotification } from './notifications';
import { showWithdrawalMenu, viewWithdrawal, approveWithdrawal, rejectWithdrawal, reprocessWithdrawal } from './withdrawalReview';
import { showManualPixPending, viewManualPix, confirmManualPixAction, rejectManualPixAction } from './pixManual';

// Roteador central de callbacks administrativos
export async function routeAdminCallback(ctx: Context, callbackData: string) {
  // Dashboard e menus principais
  if (callbackData === 'admin_dashboard') return showAdminDashboard(ctx);
  if (callbackData === 'admin_menu_config') return showConfigMenu(ctx);
  if (callbackData === 'admin_menu_actions') return showActionsMenu(ctx);
  if (callbackData === 'admin_menu_transactions') return showTransactionsMenu(ctx);
  if (callbackData === 'admin_menu_updates') return showUpdatesMenu(ctx);

  // Configurações gerais
  if (callbackData === 'admin_config_general') return showGeneralConfig(ctx);
  if (callbackData === 'config_support') return setSupport(ctx);
  if (callbackData === 'config_separator') return setSeparator(ctx);
  if (callbackData === 'config_logdest') return setLogDestination(ctx);
  if (callbackData === 'config_maintenance') return toggleMaintenance(ctx);
  if (callbackData === 'config_restart') return restartBot(ctx);

  // Admins
  if (callbackData === 'admin_config_admins') return listAdmins(ctx);
  if (callbackData === 'admin_add_adm') return addAdmin(ctx);
  if (callbackData === 'admin_remove_adm') return removeAdmin(ctx);

  // Afiliados
  if (callbackData === 'admin_config_affiliates') return showAffiliateConfig(ctx);
  if (callbackData === 'aff_toggle_system') return toggleAffiliateSystem(ctx);
  if (callbackData === 'aff_set_points') return setAffiliatePoints(ctx);
  if (callbackData === 'aff_set_min') return setAffiliateMin(ctx);
  if (callbackData === 'aff_set_multiplier') return setAffiliateMultiplier(ctx);

  // Usuários (pode ser implementado separadamente)
  if (callbackData === 'admin_config_users') return ctx.editMessage('Funcionalidade de usuários em breve.');

  // Pix
  if (callbackData === 'admin_config_pix') return showPixConfig(ctx);
  if (callbackData === 'pixcfg_toggle_mode') return togglePixMode(ctx);
  if (callbackData === 'pixcfg_set_key') return setManualPixKey(ctx);
  if (callbackData === 'pixcfg_toggle_qr') return toggleQrCode(ctx);
  if (callbackData === 'pixcfg_toggle_copy') return toggleCopyButton(ctx);
  if (callbackData === 'pixcfg_set_expiration') return setExpiration(ctx);
  if (callbackData === 'pixcfg_set_min') return setMinAmount(ctx);
  if (callbackData === 'pixcfg_set_max') return setMaxAmount(ctx);
  if (callbackData === 'pixcfg_edit_message') return editPixMessage(ctx);

  // Logins
  if (callbackData === 'admin_config_logins') return showLoginsPanel(ctx);
  if (callbackData === 'logins_add') return addLogins(ctx);
  if (callbackData === 'logins_remove') return removeLogin(ctx);
  if (callbackData === 'logins_remove_platform') return removeByPlatform(ctx);
  if (callbackData === 'logins_zero') return zeroStock(ctx);
  if (callbackData === 'logins_detailed') return detailedStock(ctx);
  if (callbackData === 'logins_change_price') return changeServicePrice(ctx);
  if (callbackData === 'logins_change_all_price') return changeAllPrices(ctx);

  // Pesquisa
  if (callbackData === 'admin_config_search') return showResearchConfig(ctx);
  if (callbackData === 'research_add_image') return addResearchImage(ctx);
  if (callbackData === 'research_remove_image') return removeResearchImage(ctx);

  // Editor de mensagens
  if (callbackData === 'admin_actions_messages') return showTemplateList(ctx);
  if (callbackData.startsWith('template_view_')) return viewTemplate(ctx, callbackData.split('_')[2]);
  if (callbackData.startsWith('template_edit_text_')) return editTemplateText(ctx, callbackData.split('_')[3]);
  if (callbackData.startsWith('template_edit_image_')) return editTemplateImage(ctx, callbackData.split('_')[3]);
  if (callbackData.startsWith('template_reset_')) return resetTemplate(ctx, callbackData.split('_')[2]);

  // Editor de botões
  if (callbackData === 'admin_actions_buttons') return showButtonList(ctx);
  if (callbackData.startsWith('btnlist_')) return viewButtonConfig(ctx, callbackData.split('_')[1]);
  if (callbackData.startsWith('btnadd_')) return addButton(ctx, callbackData.split('_')[1]);
  if (callbackData.startsWith('btnedit_')) return editButton(ctx, callbackData.split('_')[1], parseInt(callbackData.split('_')[2]));
  if (callbackData.startsWith('btnremove_')) return removeButton(ctx, callbackData.split('_')[1], parseInt(callbackData.split('_')[2]));
  if (callbackData.startsWith('btnreorder_')) return reorderButtons(ctx, callbackData.split('_')[1]);
  if (callbackData.startsWith('btnreset_')) return resetButtons(ctx, callbackData.split('_')[1]);

  // Broadcast
  if (callbackData === 'admin_actions_broadcast') return showBroadcastMenuWithButtons(ctx);
  if (callbackData.startsWith('bcast_')) {
    // Segmentos
    if (callbackData === 'bcast_all') return startBroadcastText(ctx, 'all');
    if (callbackData === 'bcast_active') return startBroadcastText(ctx, 'active');
    if (callbackData === 'bcast_buyers') return startBroadcastText(ctx, 'buyers');
    if (callbackData === 'bcast_affiliates') return startBroadcastText(ctx, 'affiliates');
    // Botões
    if (callbackData === 'bcast_btn_comprar') return addBuyButton(ctx);
    if (callbackData === 'bcast_btn_saldo') return addBalanceButton(ctx);
    if (callbackData === 'bcast_btn_cadastrar') return addRegisterButton(ctx);
    if (callbackData === 'bcast_btn_suporte') return addSupportButton(ctx);
    if (callbackData === 'bcast_btn_link') return addLinkButton(ctx);
    if (callbackData === 'bcast_send') return sendBroadcastWithButtons(ctx);
    if (callbackData === 'bcast_cancel') return ctx.editMessage('Transmissão cancelada.');
  }

  // Anti-flood
  if (callbackData === 'admin_actions_antiflood') return showAntifloodConfig(ctx);
  if (callbackData.startsWith('antiflood_set_')) return setAntifloodParam(ctx, callbackData.split('_')[2]);

  // Notificações
  if (callbackData === 'admin_actions_notifications') return showNotificationConfig(ctx);
  if (callbackData.startsWith('notif_toggle_')) return toggleNotification(ctx, callbackData.split('_')[2]);

  // Transações
  if (callbackData === 'admin_transactions_withdrawals') return showWithdrawalMenu(ctx);
  if (callbackData.startsWith('saque_view_')) return viewWithdrawal(ctx, parseInt(callbackData.split('_')[2]));
  if (callbackData.startsWith('saque_aprovar_')) return approveWithdrawal(ctx, parseInt(callbackData.split('_')[2]));
  if (callbackData.startsWith('saque_rejeitar_')) return rejectWithdrawal(ctx, parseInt(callbackData.split('_')[2]));
  if (callbackData.startsWith('saque_reprocessar_')) return reprocessWithdrawal(ctx, parseInt(callbackData.split('_')[2]));

  if (callbackData === 'admin_transactions_pix_manual') return showManualPixPending(ctx);
  if (callbackData.startsWith('pixmanual_view_')) return viewManualPix(ctx, parseInt(callbackData.split('_')[2]));
  if (callbackData.startsWith('pixmanual_confirm_')) return confirmManualPixAction(ctx, parseInt(callbackData.split('_')[2]));
  if (callbackData.startsWith('pixmanual_reject_')) return rejectManualPixAction(ctx, parseInt(callbackData.split('_')[2]));

  // Atualizações
  if (callbackData === 'admin_updates_check') return ctx.editMessage('✅ Sistema atualizado.');
  if (callbackData === 'admin_updates_logs') return ctx.editMessage('📜 Logs ainda não implementados.');
  if (callbackData === 'admin_updates_clean') return ctx.editMessage('🧹 Limpeza não implementada.');

  // Fallback
  return ctx.answerCbQuery('Ação não reconhecida.');
}
