"use client";

import { MessageCircleQuestion, Phone, SendHorizontal, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { Spinner } from "@/components/ui/spinner";
import { EMERGENCY_CONTACTS } from "@/features/sos/contacts";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/format";
import { askAssistant } from "../api";
import {
  ASSISTANT_HISTORY_TURNS,
  ASSISTANT_QUESTION_MAX_LENGTH,
  AssistantRole,
  type AssistantAnswer,
} from "../schema";

interface Message {
  id: number;
  role: AssistantRole;
  text: string;
  sources?: string[];
  needsOffice?: boolean;
  failed?: boolean;
}

const SUGGESTIONS = ["price", "pay", "notGoing", "returnTime"] as const;
const OFFICE_PHONE = EMERGENCY_CONTACTS.find((item) => item.key === "transport")?.phone ?? "";

/**
 * The students' assistant: a round button floating at the bottom of every student page (above
 * the phone's bottom bar). It opens a small chat panel; the conversation lasts until the page
 * is reloaded.
 */
export function AssistantFab() {
  const t = useTranslations("assistant");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const panelId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, isSending]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  async function ask(question: string) {
    const text = question.trim().slice(0, ASSISTANT_QUESTION_MAX_LENGTH);
    if (!text || isSending) return;
    const history = messages
      .filter((message) => !message.failed)
      .slice(-ASSISTANT_HISTORY_TURNS)
      .map((message) => ({ role: message.role, text: message.text }));
    setMessages((list) => [...list, { id: nextId.current++, role: AssistantRole.User, text }]);
    setDraft("");
    setIsSending(true);
    let reply: AssistantAnswer | null = null;
    try {
      reply = await askAssistant({ question: text, history });
    } catch {
      reply = null;
    }
    setIsSending(false);
    setMessages((list) => [
      ...list,
      reply
        ? {
            id: nextId.current++,
            role: AssistantRole.Assistant,
            text: reply.answer,
            sources: reply.sources,
            needsOffice: reply.needs_office,
          }
        : { id: nextId.current++, role: AssistantRole.Assistant, text: t("error"), failed: true },
    ]);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void ask(draft);
  }

  return (
    <>
      {open ? (
        <section
          id={panelId}
          role="dialog"
          aria-label={t("title")}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
          className={cn(
            "fixed inset-x-3 z-sheet flex flex-col overflow-hidden rounded-card border border-line bg-surface-raised shadow-lg",
            "bottom-[calc(var(--sut-nav-height)+env(safe-area-inset-bottom)+5rem)] h-[min(32rem,calc(100dvh-12rem))]",
            "desktop:inset-x-auto desktop:end-6 desktop:bottom-24 desktop:h-[min(34rem,calc(100dvh-8rem))] desktop:w-96",
          )}
        >
          <header className="flex items-center gap-3 bg-brand px-4 py-3 text-on-brand">
            <Sparkles aria-hidden="true" className="size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="text-body font-bold">{t("title")}</h2>
              <p className="text-caption opacity-90">{t("subtitle")}</p>
            </div>
            <IconButton
              label={t("close")}
              icon={<X />}
              size="sm"
              variant="onBrand"
              onClick={close}
            />
          </header>

          <ol
            ref={listRef}
            aria-live="polite"
            className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
          >
            <li className="max-w-[85%] self-start rounded-card bg-surface-alt px-3 py-2 text-body-sm text-ink">
              {t("welcome")}
            </li>
            {messages.length === 0 ? (
              <li className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => void ask(t(`suggestions.${key}`))}
                    className="rounded-pill border border-line px-3 py-1.5 text-caption font-bold text-brand focus-ring hover:bg-brand-soft"
                  >
                    {t(`suggestions.${key}`)}
                  </button>
                ))}
              </li>
            ) : null}
            {messages.map((message) => (
              <li
                key={message.id}
                className={cn(
                  "max-w-[85%] rounded-card px-3 py-2 text-body-sm whitespace-pre-line",
                  message.role === AssistantRole.User
                    ? "self-end bg-brand text-on-brand"
                    : message.failed
                      ? "self-start bg-danger-soft text-danger-text"
                      : "self-start bg-surface-alt text-ink",
                )}
              >
                <span className="sr-only">
                  {message.role === AssistantRole.User ? t("you") : t("title")}:{" "}
                </span>
                {message.text}
                {message.sources && message.sources.length > 0 ? (
                  <span className="mt-1 block text-caption text-ink-muted">
                    {t("sources", { list: message.sources.join("، ") })}
                  </span>
                ) : null}
                {message.needsOffice && OFFICE_PHONE ? (
                  <a
                    href={`tel:${OFFICE_PHONE}`}
                    className="mt-2 inline-flex items-center gap-1.5 text-caption font-bold text-brand underline focus-ring"
                  >
                    <Phone aria-hidden="true" className="size-4" />
                    {t("callOffice")} <bdi dir="ltr">{formatPhone(OFFICE_PHONE)}</bdi>
                  </a>
                ) : null}
              </li>
            ))}
            {isSending ? (
              <li className="self-start rounded-card bg-surface-alt px-3 py-2 text-ink-muted">
                <Spinner label={t("thinking")} className="[&_svg]:size-4" />
              </li>
            ) : null}
          </ol>

          <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-line p-3">
            <label htmlFor={`${panelId}-input`} className="sr-only">
              {t("inputLabel")}
            </label>
            <textarea
              id={`${panelId}-input`}
              ref={inputRef}
              rows={1}
              value={draft}
              maxLength={ASSISTANT_QUESTION_MAX_LENGTH}
              placeholder={t("placeholder")}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void ask(draft);
                }
              }}
              className="max-h-28 min-h-11 flex-1 resize-none rounded-md border border-line bg-surface px-3 py-2.5 text-body-sm text-ink focus-ring"
            />
            <IconButton
              type="submit"
              label={t("send")}
              icon={<SendHorizontal className="rtl:-scale-x-100" />}
              variant="secondary"
              disabled={isSending || draft.trim() === ""}
            />
          </form>
        </section>
      ) : null}

      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? t("close") : t("open")}
        title={open ? t("close") : t("open")}
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(
          "fixed end-4 z-sheet inline-flex size-14 items-center justify-center rounded-full bg-brand text-on-brand shadow-lg focus-ring transition-transform hover:scale-105 motion-reduce:transition-none",
          "bottom-[calc(var(--sut-nav-height)+env(safe-area-inset-bottom)+1rem)] desktop:end-6 desktop:bottom-6",
        )}
      >
        {open ? (
          <X aria-hidden="true" className="size-6" />
        ) : (
          <MessageCircleQuestion aria-hidden="true" className="size-6" />
        )}
      </button>
    </>
  );
}
