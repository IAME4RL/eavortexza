import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Send, Bot, User, Trash2, ArrowRight } from "lucide-react";
import { PortalTitle, NeonCard, PwLabel, Chip } from "@/components/portal";
import { askAssistant } from "@/lib/assistant.functions";

export const Route = createFileRoute("/_authenticated/dashboard/ai")({
  head: () => ({
    meta: [
      { title: "AI Assistant — EA VORTEX" },
      { name: "description", content: "Your dedicated AI trading coach, lot size calculator, and market analyst." },
      { property: "og:title", content: "AI Assistant — EA VORTEX" },
      { property: "og:description", content: "Ask about Gold setups, calculate risk, and analyze news events." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
});

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const STARTER_PROMPTS = [
  "Analyze current GOLD bias and key levels",
  "Calculate lot size for $500 balance with 1% risk",
  "How should I prepare for upcoming high-impact news?",
  "Explain Order Block vs Fair Value Gap (FVG)",
];

function AssistantPage() {
  const fn = useServerFn(askAssistant);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Hello! I am **VORTEX AI**, your trading assistant. I can calculate your exact lot size and risk, analyze market structure for GOLD and major pairs, explain upcoming news signals, or troubleshoot your MT5 bridge.\n\nWhat would you like to explore?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(promptText?: string) {
    const text = (promptText ?? input).trim();
    if (!text || loading) return;

    const newMsgs: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);

    try {
      const res = await fn({
        data: {
          messages: newMsgs.map((m) => ({ role: m.role, content: m.content })),
        },
      });

      if (res.ok) {
        setMessages([...newMsgs, { role: "assistant", content: res.reply }]);
      } else {
        setMessages([
          ...newMsgs,
          { role: "assistant", content: `⚠️ ${res.error ?? "Failed to get a response. Please try again."}` },
        ]);
      }
    } catch {
      setMessages([
        ...newMsgs,
        { role: "assistant", content: "⚠️ Connection error. Please try sending your message again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <PortalTitle
          title="AI Assistant"
          sub="Your 24/7 intelligent trading coach, lot-size calculator & market analyst."
        />
        {messages.length > 1 && (
          <button
            onClick={() =>
              setMessages([
                {
                  role: "assistant",
                  content: "Chat cleared. What trading questions or setups would you like to review?",
                },
              ])
            }
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border/50"
            title="Clear Chat"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Suggested quick prompt chips */}
      {messages.length <= 2 && (
        <div className="flex flex-wrap gap-2">
          {STARTER_PROMPTS.map((p) => (
            <Chip key={p} active={false} onClick={() => handleSend(p)}>
              <span className="flex items-center gap-1.5">
                {p} <ArrowRight className="h-3 w-3 opacity-60" />
              </span>
            </Chip>
          ))}
        </div>
      )}

      {/* Chat Container */}
      <NeonCard className="p-4 sm:p-5 flex flex-col h-[65dvh] min-h-[460px]">
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex items-start gap-2.5 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/20 text-primary border border-primary/40"
                }`}
              >
                {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>

              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary/20 border border-primary/40 text-foreground"
                    : "bg-background/60 border border-border/70 text-foreground/95"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/20 text-primary border border-primary/40 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 animate-spin text-primary" />
              </div>
              <div className="rounded-xl px-4 py-3 text-xs bg-background/60 border border-border/70 text-muted-foreground flex items-center gap-2">
                <span>VORTEX AI is thinking…</span>
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        {/* Input Bar */}
        <div className="mt-3 border-t border-border/50 pt-3">
          <div className="relative flex items-center">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about GOLD, lot sizing, news signals, or SMC strategies…"
              rows={1}
              className="w-full resize-none rounded-xl border border-border/80 bg-background/80 px-3.5 py-3 pr-12 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/80 transition-colors"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="absolute right-2 h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-opacity"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-center text-muted-foreground">
            VORTEX AI provides technical analysis & coaching. Always verify risk parameters before placing trades.
          </p>
        </div>
      </NeonCard>
    </div>
  );
}
