import { IdCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { OFFLINE_CARD_SCRIPT, type SavedCard } from "../saved-card";

const FIELDS = ["name", "identifier", "line", "stop", "valid_until"] as const;
const LABEL_KEYS = {
  name: "name",
  identifier: "identifier",
  line: "line",
  stop: "stop",
  valid_until: "validUntilLabel",
} as const;

/**
 * The card's details without its code, for when there's no internet. On the card page it gets
 * the saved card; on the offline page it starts hidden and empty, and a tiny inline script
 * fills it (that page may have no other script cached).
 */
export function SavedCardView({ card }: { card?: SavedCard }) {
  const t = useTranslations("student.card.offline");
  const tCard = useTranslations("student.card");
  const fromScript = card === undefined;
  return (
    <section
      id="saved-card"
      hidden={fromScript}
      aria-labelledby="saved-card-title"
      className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-card border border-line bg-surface-raised p-5 text-start shadow-card"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm bg-brand-soft text-brand [&_svg]:size-5"
        >
          <IdCard />
        </span>
        <div className="min-w-0">
          <h2 id="saved-card-title" className="text-h3 text-ink-strong">
            {t("title")}
          </h2>
          <p className="text-caption text-ink-muted">{tCard("pass")}</p>
        </div>
      </div>
      <dl className="flex flex-col divide-y divide-line">
        {FIELDS.map((field) => (
          <div key={field} className="flex flex-wrap justify-between gap-2 py-2">
            <dt className="text-body-sm text-ink-muted">{t(LABEL_KEYS[field])}</dt>
            <dd className="text-body-sm font-bold text-ink-strong" data-saved-card={field}>
              <bdi>{card?.[field] ?? ""}</bdi>
            </dd>
          </div>
        ))}
      </dl>
      <p className="rounded-md bg-warning-soft px-3 py-2 text-body-sm text-ink-strong">
        {t("noCode")}
      </p>
      {fromScript ? <script dangerouslySetInnerHTML={{ __html: OFFLINE_CARD_SCRIPT }} /> : null}
    </section>
  );
}
