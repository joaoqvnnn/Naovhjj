# Revisão de Callbacks Administrativos

## Menus Principais
- `admin_dashboard` → showAdminDashboard
- `admin_menu_config` → showConfigMenu
- `admin_menu_actions` → showActionsMenu
- `admin_menu_transactions` → showTransactionsMenu
- `admin_menu_updates` → showUpdatesMenu

## Segurança
- `security_menu` → showSecurityConfig
- `security_toggle_2fa` → toggle2FA
- `security_toggle_device` → toggleDeviceSecurity
- `security_toggle_strict` → toggleStrictDevice
- `security_set_attempts` → setMaxPasswordAttempts
- `security_set_block` → setBlockDuration

## Configurações Gerais
- `admin_config_general` → showGeneralConfig
- `config_support` → setSupport
- `config_separator` → setSeparator
- `config_logdest` → setLogDestination
- `config_maintenance` → toggleMaintenance
- `config_restart` → restartBot

## Admins
- `admin_config_admins` → listAdmins
- `admin_add_adm` → addAdmin
- `admin_remove_adm` → removeAdmin

## Afiliados
- `admin_config_affiliates` → showAffiliateConfig
- `aff_toggle_system` → toggleAffiliateSystem
- `aff_set_points` → setAffiliatePoints
- `aff_set_min` → setAffiliateMin
- `aff_set_multiplier` → setAffiliateMultiplier

## Usuários
- `admin_config_users` → placeholder

## Pix
- `admin_config_pix` → showPixConfig
- `pixcfg_toggle_mode` → togglePixMode
- `pixcfg_set_key` → setManualPixKey
- `pixcfg_toggle_qr` → toggleQrCode
- `pixcfg_toggle_copy` → toggleCopyButton
- `pixcfg_set_expiration` → setExpiration
- `pixcfg_set_min` → setMinAmount
- `pixcfg_set_max` → setMaxAmount
- `pixcfg_edit_message` → editPixMessage

## Logins
- `admin_config_logins` → showLoginsPanel
- `logins_add` → addLogins
- `logins_remove` → removeLogin
- `logins_remove_platform` → removeByPlatform
- `logins_zero` → zeroStock
- `logins_detailed` → detailedStock
- `logins_change_price` → changeServicePrice
- `logins_change_all_price` → changeAllPrices

## Pesquisa
- `admin_config_search` → showResearchConfig
- `research_add_image` → addResearchImage
- `research_remove_image` → removeResearchImage

## Editor de Mensagens
- `admin_actions_messages` → showTemplateList
- `template_view_*` → viewTemplate
- `template_edit_text_*` → editTemplateText
- `template_edit_image_*` → editTemplateImage
- `template_reset_*` → resetTemplate

## Editor de Botões
- `admin_actions_buttons` → showButtonList
- `btnlist_*` → viewButtonConfig
- `btnadd_*` → addButton
- `btnedit_*` → editButton
- `btnremove_*` → removeButton
- `btnreorder_*` → reorderButtons
- `btnreset_*` → resetButtons

## Broadcast
- `admin_actions_broadcast` → showBroadcastMenuWithButtons
- `bcast_all` → startBroadcastText(all)
- `bcast_active` → startBroadcastText(active)
- `bcast_buyers` → startBroadcastText(buyers)
- `bcast_affiliates` → startBroadcastText(affiliates)
- `bcast_btn_comprar` → addBuyButton
- `bcast_btn_saldo` → addBalanceButton
- `bcast_btn_cadastrar` → addRegisterButton
- `bcast_btn_suporte` → addSupportButton
- `bcast_btn_link` → addLinkButton
- `bcast_send` → sendBroadcastWithButtons
- `bcast_cancel` → cancelar transmissão

## Anti-flood
- `antiflood_menu` → showAntifloodConfig
- `antiflood_set_*` → setAntifloodParam
- `wa_af_menu` → handleWhatsAppAntiFloodMenu
- `wa_af_set_*` → handleWhatsAppAntiFloodSet
- `admin_actions_antiflood` → menu escolha Telegram/WhatsApp

## Notificações
- `admin_actions_notifications` → showNotificationConfig
- `notif_toggle_*` → toggleNotification

## Transações
- `admin_transactions_withdrawals` → showWithdrawalMenu
- `saque_view_*` → viewWithdrawal
- `saque_aprovar_*` → approveWithdrawal
- `saque_rejeitar_*` → rejectWithdrawal
- `saque_reprocessar_*` → reprocessWithdrawal
- `admin_transactions_pix_manual` → showManualPixPending
- `pixmanual_view_*` → viewManualPix
- `pixmanual_confirm_*` → confirmManualPixAction
- `pixmanual_reject_*` → rejectManualPixAction

## Estatísticas
- `admin_transactions_stats` → showDetailedStats
- `stats_refresh` → showDetailedStats

## Promoções e Cupons
- `promo_menu` → showPromotionsMenu
- `promo_new_scheduled` → createScheduledPromotion
- `promo_new_coupon` → createCouponPromotion
- `promo_list` → listPromotions
- `promo_segment_*` → finalizeScheduledPromotion
- `activate_coupon_*` → handleActivateCoupon
- `copy_coupon_*` → copiar código
- `redeem_coupon_*` → handleRedeemCoupon

## Gift Cards
- `giftcard_admin_menu` → showGiftCardAdminMenu
- `giftcard_admin_create` → createGiftCard
- `giftcard_admin_batch` → createGiftCardBatch
- `giftcard_admin_list` → listGiftCards
- `giftcard_admin_view_*` → viewGiftCard
- `giftcard_admin_disable_*` → disableGiftCard
- `giftcard_admin_delete_*` → deleteGiftCard

## Atualizações
- `admin_updates_check` → checkUpdates
- `admin_updates_logs` → viewSystemLogs
- `admin_updates_clean` → cleanOldData

## Menu Pessoal Admin
- `admin_start` → goToScreen('admin_start')
- `admin_rent_bot` → showRentBot
- `menu_pesquisar` → instrução de pesquisa inline
