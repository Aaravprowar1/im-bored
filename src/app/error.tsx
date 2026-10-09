"use client";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/card";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <Container className="flex flex-col items-center pt-24 text-center">
      <p className="font-serif text-6xl">Oops.</p>
      <p className="mt-3 text-muted">Something went wrong on our side. Please try again.</p>
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </Container>
  );
}
