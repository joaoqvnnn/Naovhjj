# 🤖 Larizinha Store — Bot de Loja Digital no Telegram

Bot completo de loja digital para Telegram, com painel administrativo integrado, Pix automático via Mercado Pago, entrega por e-mail/WhatsApp, sistema de afiliados, saques, Gift Cards, alertas de estoque, rankings e muito mais.

---

## ✨ Funcionalidades

### 👤 Painel do Cliente
- `/start` com ID e saldo reais, mensagem editável
- Catálogo de categorias e produtos
- Tela de produto com preço, estoque, visualizações, garantia
- Compra única e múltipla com cálculo automático
- Saldo insuficiente com sugestão de Pix
- Pix automático (QR Code + copia e cola) e manual
- Expiração de pagamento com liberação de estoque
- Entrega por e-mail e WhatsApp com ativação por senha
- Histórico de compras com paginação
- Perfil com movimentações reais
- Alteração de WhatsApp com validação flexível
- Recarga com bônus configurável
- Afiliados com link individual e pontos
- Rankings (serviços, recargas, saldo, compras)
- Alertas de estoque
- Pesquisa inline
- Gift Card
- Suporte com IA e atendimento direto

### 👑 Painel Administrativo (dentro do Telegram)
- Dashboard com métricas reais
- Configurações gerais (suporte, separador, logs, manutenção)
- Gerenciamento de admins
- Configuração de afiliados (pontos, multiplicador, sistema)
- Gerenciamento de usuários (pesquisar, bloquear, ajustar saldo, PDF)
- Configuração de Pix (token, limites, expiração, bônus)
- Gerenciamento de logins/estoque em lote
- Configuração de pesquisa
- Editor de mensagens e botões
- Transmissão com botões dinâmicos
- Anti-flood (Telegram e WhatsApp)
- Notificações administrativas
- Segurança (2FA, proteção por dispositivo)
- Promoções agendadas e cupons
- Gift Cards (CRUD)
- Atualizações (logs, limpeza, backup, reset)
- Aluguel de bot

### 🌐 Web
- Ativação de produtos com senha
- Recuperação de senha via e-mail
- Saque bancário com login seguro e 2FA
- Histórico de saques
- Termos e Sobre

### 🛡️ Segurança
- Proteção por IP/dispositivo
- 2FA opcional
- Anti-flood por ação
- Validações de entrada
- Transações no banco
- Reserva de estoque com expiração

---

## 🚀 Instalação

### Pré-requisitos
- Node.js 18+
- PostgreSQL
- Token do bot Telegram (BotFather)
- Conta Mercado Pago (Access Token)
- Chave OpenAI (opcional, para IA e transcrição)
- Servidor SMTP para e-mails (ex: Gmail, SendGrid)

### Passos

1. **Clone o repositório**
   ```bash
   git clone https://seu-repositorio.git
   cd larizinhastore
