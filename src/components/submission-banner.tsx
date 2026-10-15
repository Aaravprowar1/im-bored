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
          It&apos;s free. A real person reads every one, approved ideas join the library, and everyone gets to vote on them.
        </p>
      </div>
      <ButtonLink href="/submit" size="lg" className="w-full shrink-0 md:w-auto">
        Suggest an idea <ArrowRight className="size-4" aria-hidden />
      </ButtonLink>
    </Card>
  );
}
