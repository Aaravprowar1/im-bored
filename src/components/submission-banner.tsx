import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function SubmissionBanner() {
  return (
    <Card tone="blue" className="flex flex-col gap-6 p-6 sm:p-10 md:flex-row md:items-center md:justify-between">
      <div className="max-w-xl">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink/60">Got a good one?</p>
        <h2 className="mt-2 font-serif text-4xl leading-[1.02] sm:text-5xl">Suggest an activity.</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/75">
          Submit your idea for review for <strong className="font-semibold text-ink">$1.00 USD</strong>. A real person reads every one.
          Approved ideas join the library. The fee covers review, not guaranteed publication.
        </p>
      </div>
      <ButtonLink href="/submit" size="lg" className="w-full shrink-0 md:w-auto">
        Submit an idea for $1 <ArrowRight className="size-4" aria-hidden />
      </ButtonLink>
    </Card>
  );
}
