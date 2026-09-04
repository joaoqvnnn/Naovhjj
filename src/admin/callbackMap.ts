import { Context } from '../types/context';

// Mapa de callbacks administrativos para referência rápida
export const adminCallbackMap: Record<string, (ctx: Context, data?: string) => Promise<any>> = {
  // Dashboard e menus principais
  'admin_dashboard': (ctx) => import('./adminMenu').then(m => m.showAdminDashboard(ctx)),
  'admin_menu_config': (ctx) => import('./adminMenu').then(m => m.showConfigMenu(ctx)),
  'admin_menu_actions': (ctx) => import('./adminMenu').then(m => m.showActionsMenu(ctx)),
  'admin_menu_transactions': (ctx) => import('./adminMenu').then(m => m.showTransactionsMenu(ctx)),
  'admin_menu_updates': (ctx) => import('./adminMenu').then(m => m.showUpdatesMenu(ctx)),

  // Configurações gerais
  'admin_config_general': (ctx) => import('./generalConfig').then(m => m.showGeneralConfig(ctx)),
  'config_support': (ctx) => import('./generalConfig').then(m => m.setSupport(ctx)),
  'config_separator': (ctx) => import('./generalConfig').then(m => m.setSeparator(ctx)),
  'config_logdest': (ctx) => import('./generalConfig').then(m => m.setLogDestination(ctx)),
  'config_maintenance': (ctx) => import('./generalConfig').then(m => m.toggleMaintenance(ctx)),
  'config_restart': (ctx) => import('./generalConfig').then(m => m.restartBot(ctx)),

  // Admins
  'admin_config_admins': (ctx) => import('./adminActions').then(m => m.listAdmins(ctx)),
  'admin_add_adm': (ctx) => import('./adminActions').then(m => m.addAdmin(ctx)),
  'admin_remove_adm': (ctx) => import('./adminActions').then(m => m.removeAdmin(ctx)),

  // Afiliados
  'admin_config_affiliates': (ctx) => import('./affiliateConfig').then(m => m.showAffiliateConfig(ctx)),
  'aff_toggle_system': (ctx) => import('./affiliateConfig').then(m => m.toggleAffiliateSystem(ctx)),
  'aff_set_points': (ctx) => import('./affiliateConfig').then(m => m.setAffiliatePoints(ctx)),
  'aff_set_min': (ctx) => import('./affiliateConfig').then(m => m.setAffiliateMin(ctx)),
  'aff_set_multiplier': (ctx) => import('./affiliateConfig').then(m => m.setAffiliateMultiplier(ctx)),

  // Usuários
  'admin_config_users': (ctx) => import('./userManagementFull').then(m => m.showUsersMenu(ctx)),
  'users_menu': (ctx) => import('./userManagementFull').then(m => m.showUsersMenu(ctx)),
  'users_list': (ctx) => import('./userManagementFull').then(m => m.listUsers(ctx)),
  'users_search': (ctx) => import('./userManagementFull').then(m => m.searchUser(ctx, '')),

  // Produtos e Categorias
  'admin_config_products': (ctx) => import('./productCategoryAdminFull').then(m => m.listProducts(ctx)),
  'prod_list': (ctx) => import('./productCategoryAdminFull').then(m => m.listProducts(ctx)),
  'prod_new': (ctx) => import('./productCategoryAdminFull').then(m => m.createProduct(ctx)),
  'cat_menu': (ctx) => import('./productCategoryAdminFull').then(m => m.listCategories(ctx)),
  'cat_new': (ctx) => import('./productCategoryAdminFull').then(m => m.createCategory(ctx)),

  // Pix
  'admin_config_pix': (ctx) => import('./pixConfig').then(m => m.showPixConfig(ctx)),
  'pixcfg_toggle_mode': (ctx) => import('./pixConfig').then(m => m.togglePixMode(ctx)),
  'pixcfg_set_key': (ctx) => import('./pixConfig').then(m => m.setManualPixKey(ctx)),
  'pixcfg_toggle_qr': (ctx) => import('./pixConfig').then(m => m.toggleQrCode(ctx)),
  'pixcfg_toggle_copy': (ctx) => import('./pixConfig').then(m => m.toggleCopyButton(ctx)),

  // Editor de mensagens
  'admin_actions_messages': (ctx) => import('./templateEditor').then(m => m.showTemplateList(ctx)),
  'template_view_': (ctx, key) => import('./templateEditor').then(m => m.viewTemplate(ctx, key!)),
  'template_edit_text_': (ctx, key) => import('./templateEditor').then(m => m.editTemplateText(ctx, key!)),
  'template_edit_image_': (ctx, key) => import('./templateEditor').then(m => m.editTemplateImage(ctx, key!)),
  'template_reset_': (ctx, key) => import('./templateEditor').then(m => m.resetTemplate(ctx, key!)),

  // Editor de botões
  'admin_actions_buttons': (ctx) => import('./buttonEditorFull').then(m => m.showButtonList(ctx)),
  'btnlist_': (ctx, key) => import('./buttonEditorFull').then(m => m.viewButtonConfig(ctx, key!)),
  'btnadd_': (ctx, key) => import('./buttonEditorFull').then(m => m.addButton(ctx, key!)),
  'btnedit_': (ctx, key) => import('./buttonEditorFull').then(m => m.editButton(ctx, key!, 0)),
  'btnremove_': (ctx, key) => import('./buttonEditorFull').then(m => m.removeButton(ctx, key!, 0)),
  'btnreorder_': (ctx, key) => import('./buttonEditorFull').then(m => m.reorderButtons(ctx, key!)),
  'btnreset_': (ctx, key) => import('./buttonEditorFull').then(m => m.resetButtons(ctx, key!)),
};
