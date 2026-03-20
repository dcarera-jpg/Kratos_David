-- PATCH: Telegram notification support for coaches
-- Run this in Supabase SQL editor

ALTER TABLE coach_profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id text;

-- How to get your Telegram chat_id:
-- 1. Create a bot via @BotFather on Telegram → get TELEGRAM_BOT_TOKEN
-- 2. Send any message to your bot
-- 3. Open: https://api.telegram.org/bot{TOKEN}/getUpdates
-- 4. Copy the "id" field from result.message.chat → that's your chat_id
-- 5. Set TELEGRAM_BOT_TOKEN in Cloudflare Worker env vars
-- 6. Paste chat_id in Kratos Coach Profile → Notifications section
