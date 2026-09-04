import { Context } from '../types/context';
import { showConfigMenu, showActionsMenu, showTransactionsMenu, showUpdatesMenu, showAdminDashboard } from './adminMenu';
import { showGeneralConfig, setSupport, setSeparator, setLogDestination, toggleMaintenance, restartBot } from './generalConfig';
import { listAdmins, addAdmin, removeAdmin } from './adminActions';
import { showAffiliateConfig, toggleAffiliateSystem, setAffiliatePoints, setAffiliateMin, setAffiliateMultiplier } from './affiliateConfig';
import { showPixConfig, togglePixMode, setManualPixKey, toggleQrCode, toggleCopyButton, setExpiration, setMinAmount, setMaxAmount, editPixMessage } from './pixConfig';
import { showLoginsPanel, addLogins, removeLogin, removeByPlatform, zeroStock, detailedStock, changeServicePrice, changeAllPrices } from './loginsStockFull';
import { showResearchConfig, addResearchImage, removeResearchImage } from './researchConfig';
import { showTemplateList, viewTemplate, editTemplateText, editTemplateImage, resetTemplate } from './templateEditor';
import { showButtonList, viewButtonConfig, addButton, editButton, removeButton, reorderButtons, resetButtons } from './buttonEditorFull';
import { showBroadcastMenuWithButtons, startBroadcastText, addBuyButton, addBalanceButton, addRegisterButton, addSupportButton, addLinkButton, sendBroadcastWithButtons } from './broadcastWithButtons';
import { showAntifloodConfig, setAntifloodParam } from './antifloodConfig';
import { showNotificationConfig, toggleNotification } from './notifications';
import { showWithdrawalMenu, viewWithdrawal, approveWithdrawal, rejectWithdrawal, reprocessWithdrawal } from './withdrawalReview';
import { showManualPixPending, viewManualPix, confirmManualPixAction, rejectManualPixAction } from './pixManual';
import { showDetailedStats } from './dashboardStats';
import { showPromotionSettings, setAutoDelete, setViewerExpiration } from './promotionSettings';
import { showInactivityConfig, setInactivityDays } from './inactivityConfig';
import { showTranscriptionConfig, setTranscriptionKey } from './transcriptionConfig';
import { showGiftCardAdminMenu, createGiftCard, createGiftCardBatch, listGiftCards, viewGiftCard, disableGiftCard, deleteGiftCard } from './giftCardAdmin';
import { checkUpdates, viewSystemLogs, cleanOldData, backupConfig, resetMessages } from './updatesActions';
import { showSecurityConfig, toggle2FA, toggleDeviceSecurity, toggleStrictDevice, setMaxPasswordAttempts, setBlockDuration } from './securityConfig';
import { showUsersMenu, listUsers, searchUser, editUserBalance, toggleUserBlock, sendMessageToUser } from './userManagementFull';
import { generateUserHistoryPdf } from '../flows/userHistoryPdf';
import { showSobreConfig, editSobreContent } from './sobreConfig';
import { showSupportConfig, editSupportLink, editBotVersion, editStoreName } from './supportConfig';
import { listProducts, createProduct, editProduct, editProductName, editProductPrice, editProductDescription, editProductImage, toggleProduct, deleteProduct, listCategories, createCategory, editCategoryName, deleteCategory } from './productCategoryAdminFull';
import { startCapture } from '../middlewares/capture';

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

  // Usuários
  if (callbackData === 'admin_config_users') return showUsersMenu(ctx);
  if (callbackData === 'users_menu') return showUsersMenu(ctx);
  if (callbackData === 'users_list') return listUsers(ctx);
  if (callbackData.startsWith('users_page_')) return listUsers(ctx, parseInt(callbackData.split('_')[2]));
  if (callbackData === 'users_search') {
    return startCapture(ctx, 'users_search_term', 'Digite o ID, Telegram ID ou username:', {
      validate: async (input) => input.trim().length > 0 ? null : 'Digite algo.',
      onSuccess: async (ctx, term) => searchUser(ctx, term),
    });
  }
  if (callbackData.startsWith('user_edit_balance_')) return editUserBalance(ctx, parseInt(callbackData.split('_')[3]));
  if (callbackData.startsWith('user_toggle_block_')) return toggleUserBlock(ctx, parseInt(callbackData.split('_')[3]));
  if (callbackData.startsWith('user_message_')) return sendMessageToUser(ctx, parseInt(callbackData.split('_')[2]));
  if (callbackData.startsWith('user_pdf_')) return generateUserHistoryPdf(ctx, parseInt(callbackData.split('_')[2]));

  // Produtos e Categorias
  if (callbackData === 'admin_config_products') return listProducts(ctx);
  if (callbackData === 'prod_list') return listProducts(ctx);
  if (callbackData.startsWith('products_page_')) return listProducts(ctx, parseInt(callbackData.split('_')[2]));
  if (callbackData === 'prod_new') return createProduct(ctx);
  if (callbackData.startsWith('prod_edit_') && !callbackData.startsWith('prod_edit_name_') && !callbackData.startsWith('prod_edit_price_') && !callbackData.startsWith('prod_edit_desc_') && !callbackData.startsWith('prod_edit_image_')) {
    return editProduct(ctx, parseInt(callbackData.split('_')[2]));
  }
  if (callbackData.startsWith('prod_edit_name_')) return editProductName(ctx, parseInt(callbackData.split('_')[3]));
  if (callbackData.startsWith('prod_edit_price_')) return editProductPrice(ctx, parseInt(callbackData.split('_')[3]));
  if (callbackData.startsWith('prod_edit_desc_')) return editProductDescription(ctx, parseInt(callbackData.split('_')[3]));
  if (callbackData.startsWith('prod_edit_image_')) return editProductImage(ctx, parseInt(callbackData.split('_')[3]));
  if (callbackData.startsWith('prod_toggle_')) return toggleProduct(ctx, parseInt(callbackData.split('_')[2]));
  if (callbackData.startsWith('prod_delete_')) return deleteProduct(ctx, parseInt(callbackData.split('_')[2]));

  if (callbackData === 'cat_menu') return listCategories(ctx);
  if (callbackData === 'cat_new') return createCategory(ctx);
  if (callbackData.startsWith('cat_edit_') && !callbackData.startsWith('cat_edit_name_')) {
    return editCategoryName(ctx, parseInt(callbackData.split('_')[2]));
  }
  if (callbackData.startsWith('cat_edit_name_')) return editCategoryName(ctx, parseInt(callbackData.split('_')[3]));
  if (callbackData.startsWith('cat_delete_')) return deleteCategory(ctx, parseInt(callbackData.split('_')[2]));

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
  if (callbackData === 'bcast_all') return startBroadcastText(ctx, 'all');
  if (callbackData === 'bcast_active') return startBroadcastText(ctx, 'active');
  if (callbackData === 'bcast_buyers') return startBroadcastText(ctx, 'buyers');
  if (callbackData === 'bcast_affiliates') return startBroadcastText(ctx, 'affiliates');
  if (callbackData === 'bcast_btn_comprar') return addBuyButton(ctx);
  if (callbackData === 'bcast_btn_saldo') return addBalanceButton(ctx);
  if (callbackData === 'bcast_btn_cadastrar') return addRegisterButton(ctx);
  if (callbackData === 'bcast_btn_suporte') return addSupportButton(ctx);
  if (callbackData === 'bcast_btn_link') return addLinkButton(ctx);
  if (callbackData === 'bcast_send') return sendBroadcastWithButtons(ctx);
  if (callbackData === 'bcast_cancel') return ctx.editMessage('Transmissão cancelada.');

  // Anti-flood Telegram
  if (callbackData === 'antiflood_menu') return showAntifloodConfig(ctx);
  if (callbackData.startsWith('antiflood_set_')) return setAntifloodParam(ctx, callbackData.split('_')[2]);

  // Anti-flood WhatsApp
  if (callbackData === 'wa_af_menu') return showWhatsAppAntiFloodConfig(ctx);
  if (callbackData.startsWith('wa_af_set_')) return setWhatsAppAntiFloodParam(ctx, callbackData.split('_')[3]);

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

  // Estatísticas
  if (callbackData === 'admin_transactions_stats') return showDetailedStats(ctx);
  if (callbackData === 'stats_refresh') return showDetailedStats(ctx);

  // Promoções e configurações
  if (callbackData === 'promo_settings') return showPromotionSettings(ctx);
  if (callbackData === 'promo_set_autodelete') return setAutoDelete(ctx);
  if (callbackData === 'promo_set_viewers') return setViewerExpiration(ctx);

  // Inatividade
  if (callbackData === 'admin_inactivity') return showInactivityConfig(ctx);
  if (callbackData === 'inactivity_set_days') return setInactivityDays(ctx);

  // Transcrição
  if (callbackData === 'admin_transcription') return showTranscriptionConfig(ctx);
  if (callbackData === 'transcription_set_key') return setTranscriptionKey(ctx);

  // Gift Cards
  if (callbackData === 'giftcard_admin_menu') return showGiftCardAdminMenu(ctx);
  if (callbackData === 'giftcard_admin_create') return createGiftCard(ctx);
  if (callbackData === 'giftcard_admin_batch') return createGiftCardBatch(ctx);
  if (callbackData === 'giftcard_admin_list') return listGiftCards(ctx);
  if (callbackData.startsWith('giftcard_admin_view_')) return viewGiftCard(ctx, parseInt(callbackData.split('_')[3]));
  if (callbackData.startsWith('giftcard_admin_disable_')) return disableGiftCard(ctx, parseInt(callbackData.split('_')[3]));
  if (callbackData.startsWith('giftcard_admin_delete_')) return deleteGiftCard(ctx, parseInt(callbackData.split('_')[3]));

  // Atualizações
  if (callbackData === 'admin_updates_check') return checkUpdates(ctx);
  if (callbackData === 'admin_updates_logs') return viewSystemLogs(ctx);
  if (callbackData === 'admin_updates_clean') return cleanOldData(ctx);
  if (callbackData === 'admin_updates_backup') return backupConfig(ctx);
  if (callbackData === 'admin_updates_reset') return resetMessages(ctx);

  // Fallback
  return ctx.answerCbQuery('Ação não reconhecida.');
}
