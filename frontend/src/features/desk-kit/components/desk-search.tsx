"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { TextField } from "@/components/ui/input";

const SEARCH_DELAY_MS = 300;

/** A search box that tells the page what to look for once the office stops typing. */
export function DeskSearch({
  hint,
  onSearch,
}: {
  /** What the box searches: "University ID, name or receipt number". */
  hint: string;
  onSearch: (query: string) => void;
}) {
  const t = useTranslations("desk.common");
  const [text, setText] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => onSearch(text.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [text, onSearch]);

  return (
    <TextField
      type="search"
      label={t("search")}
      hint={hint}
      icon={<Search />}
      value={text}
      onChange={(event) => setText(event.target.value)}
      containerClassName="w-full desktop:max-w-md"
      autoComplete="off"
    />
  );
}
