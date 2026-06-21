-- ═══════════════════════════════════════════════════════════
-- Migration 003: Chatbot Tables
-- Creates chatbot_chats and chatbot_messages tables with RLS
-- ═══════════════════════════════════════════════════════════

-- ── Chatbot chats table (one row per chat session) ──
CREATE TABLE IF NOT EXISTS public.chatbot_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Chatbot messages table ──
CREATE TABLE IF NOT EXISTS public.chatbot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chatbot_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'bot')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_chatbot_chats_user_id ON public.chatbot_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_chat_id ON public.chatbot_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_user_id ON public.chatbot_messages(user_id);

-- ── Enable RLS ──
ALTER TABLE public.chatbot_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies: chatbot_chats ──
CREATE POLICY "Users can view own chats" ON public.chatbot_chats
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chats" ON public.chatbot_chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chats" ON public.chatbot_chats
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own chats" ON public.chatbot_chats
  FOR DELETE USING (auth.uid() = user_id);

-- ── RLS Policies: chatbot_messages ──
CREATE POLICY "Users can view own messages" ON public.chatbot_messages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messages" ON public.chatbot_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own messages" ON public.chatbot_messages
  FOR DELETE USING (auth.uid() = user_id);
