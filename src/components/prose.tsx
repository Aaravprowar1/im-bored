import { Container, Notice } from "@/components/ui/card";

export function ProsePage({ title, updated, draft, children }: { title: string; updated?: string; draft?: boolean; children: React.ReactNode }) {
  return (
    <Container className="max-w-3xl pt-12 sm:pt-16">
      <h1 className="font-serif text-5xl leading-none sm:text-6xl">{title}</h1>
      {updated ? <p className="mt-3 text-sm text-muted">Last updated {updated}</p> : null}
      {draft ? (
        <Notice tone="warning" className="mt-6" title="Draft for review">
          This document is a starting template. Items in [square brackets] must be filled in by the site operator, and the whole document should be reviewed by a qualified lawyer before this site is used commercially.
        </Notice>
      ) : null}
      <div className="mt-8 space-y-5 text-[16px] leading-relaxed text-ink/85 [&_a]:underline [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-3xl [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
        {children}
      </div>
    </Container>
  );
}

export const OPERATOR = "[Operator legal name]";
