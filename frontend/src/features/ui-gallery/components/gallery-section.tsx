import type { ReactNode } from "react";

interface GallerySectionProps {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export function GallerySection({ id, title, description, children }: GallerySectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20">
      <h2 id={`${id}-title`} className="text-h2">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 max-w-3xl text-body-sm text-ink-muted">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
