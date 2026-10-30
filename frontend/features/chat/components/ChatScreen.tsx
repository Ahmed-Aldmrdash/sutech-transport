"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { useErrorMessage } from "@/components/ui/States";
import { useMutation } from "@/lib/api/use-api";
import { cn } from "@/lib/cn";
import { askAssistant } from "../api";
import type { ChatTurn } from "../schema";

const MAX_HISTORY = 20;
const SUGGESTIONS = ["howToPay", "refund", "whereIsBus", "notGoing"] as const;

/** The transport assistant. Answers come from the server (Gemini, prototype); history stays on this screen only. */
export function ChatScreen() {
  const t = useTranslations("chat");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [text, setText] = useState("");
  const ask = useMutation(askAssistant);
  const error = useErrorMessage(ask.error);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, ask.pending]);

  async function send(message: string) {
    const value = message.trim();
    if (!value || ask.pending) return;
    const history = turns.slice(-MAX_HISTORY);
    setTurns((current) => [...current, { role: "user", text: value }]);
    setText("");
    const result = await ask.run(value, history);
    if (result) setTurns((current) => [...current, { role: "assistant", text: result.reply }]);
  }

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="flex flex-1 flex-col gap-3" aria-live="polite">
        {turns.length === 0 && (
          <div className="flex flex-col gap-3 rounded-card bg-surface-alt p-4">
            <p className="flex items-center gap-2 font-bold">
              <Bot className="size-5 text-brand" aria-hidden />
              {t("hello")}
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((key) => (
                <button key={key} type="button" onClick={() => void send(t(`suggestions.${key}`))} className="min-h-10 rounded-full border border-line-strong bg-surface-raised px-3 text-[14px] font-bold text-brand hover:bg-brand-soft">
                  {t(`suggestions.${key}`)}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((turn, index) => (
          <p
            key={index}
            className={cn(
              "max-w-[85%] rounded-lg px-4 py-2.5 whitespace-pre-line",
              turn.role === "user" ? "self-end bg-brand text-on-brand" : "self-start bg-surface-raised text-ink shadow-card",
            )}
          >
            <span className="sr-only">{turn.role === "user" ? t("you") : t("assistant")}: </span>
            {turn.text}
          </p>
        ))}
        {ask.pending && <p className="self-start rounded-lg bg-surface-raised px-4 py-2.5 text-ink-muted shadow-card">{t("thinking")}</p>}
        {error && <Banner tone="danger">{error}</Banner>}
        <div ref={end} />
      </div>
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void send(text);
        }}
        className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] mt-4 flex gap-2 bg-surface py-2"
      >
        <label htmlFor="chat-input" className="sr-only">
          {t("placeholder")}
        </label>
        <input
          id="chat-input"
          value={text}
          maxLength={1000}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("placeholder")}
          className="min-h-12 flex-1 rounded-md border border-line-strong bg-surface-raised px-3"
        />
        <Button type="submit" aria-label={t("send")} disabled={!text.trim()} loading={ask.pending} icon={<Send className="flip-rtl size-4" aria-hidden />} />
      </form>
      <p className="text-center text-[12px] text-ink-muted">{t("disclaimer")}</p>
    </div>
  );
}
