"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Bot, Send, ThumbsUp, ThumbsDown, Pin, Archive, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CopilotConversation, CopilotMessage } from "@grc/shared";

export default function CopilotChatPage() {
  const t = useTranslations("copilot");
  const [conversations, setConversations] = useState<CopilotConversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/copilot/conversations?limit=50");
      if (res.ok) {
        const json = await res.json();
        setConversations(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (convId: string) => {
    const res = await fetch(`/api/v1/copilot/conversations/${convId}/messages?limit=100`);
    if (res.ok) {
      const json = await res.json();
      setMessages(json.data.reverse());
    }
  }, []);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (activeConv) void fetchMessages(activeConv);
  }, [activeConv, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createConversation = async () => {
    const res = await fetch("/api/v1/copilot/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "de" }),
    });
    if (res.ok) {
      const json = await res.json();
      setActiveConv(json.data.id);
      await fetchConversations();
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeConv || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/v1/copilot/conversations/${activeConv}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input }),
      });
      if (res.ok) {
        setInput("");
        await fetchMessages(activeConv);
        await fetchConversations();
      }
    } finally {
      setSending(false);
    }
  };

  const submitFeedback = async (messageId: string, rating: number) => {
    await fetch(`/api/v1/copilot/messages/${messageId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      {/* Sidebar - Conversations */}
      <div className="w-80 flex flex-col border-r">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">{t("title")}</h2>
          <Button size="sm" onClick={createConversation}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveConv(conv.id)}
              className={`w-full p-3 text-left border-b hover:bg-muted/50 transition-colors ${activeConv === conv.id ? "bg-muted" : ""}`}
            >
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium truncate">
                  {conv.title ?? t("newConversation")}
                </span>
                {conv.isPinned && <Pin className="h-3 w-3 text-primary" />}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>{conv.messageCount} {t("messages")}</span>
                <span>{conv.language.toUpperCase()}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeConv ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-1 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => submitFeedback(msg.id, 1)}
                        >
                          <ThumbsUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => submitFeedback(msg.id, -1)}
                        >
                          <ThumbsDown className="h-3 w-3" />
                        </Button>
                        {msg.model && (
                          <span className="text-xs text-muted-foreground ml-2">{msg.model}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder={t("inputPlaceholder")}
                  className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                  disabled={sending}
                />
                <Button onClick={sendMessage} disabled={sending || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Bot className="h-12 w-12 mx-auto mb-4" />
              <p className="text-lg font-medium">{t("welcomeTitle")}</p>
              <p className="text-sm mt-1">{t("welcomeDescription")}</p>
              <Button className="mt-4" onClick={createConversation}>
                {t("startConversation")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
