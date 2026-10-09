import { Card, Container, Notice } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/config";

export function AuthShell({ title, intro, children, footer }: { title: string; intro?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Container className="flex justify-center pt-12 sm:pt-20">
      <div className="w-full max-w-md">
        <h1 className="text-center font-serif text-5xl leading-none">{title}</h1>
        {intro ? <p className="mt-3 text-center text-muted">{intro}</p> : null}
        <Card className="mt-8 p-6 sm:p-8">
          {isSupabaseConfigured() ? (
            children
          ) : (
            <Notice tone="warning" title="Accounts aren't set up yet">
              This site is running without Supabase, so signing in isn&apos;t available. You can still generate activities and save favourites on this device. Site owners: see the README to connect Supabase.
            </Notice>
          )}
        </Card>
        {footer ? <div className="mt-6 text-center text-sm text-muted">{footer}</div> : null}
      </div>
    </Container>
  );
}
