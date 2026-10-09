import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/card";

export default function NotFound() {
  return (
    <Container className="flex flex-col items-center pt-24 text-center">
      <p className="font-serif text-7xl">404.</p>
      <p className="mt-3 text-muted">This page doesn&apos;t exist. Bored? We can fix that.</p>
      <ButtonLink href="/" className="mt-6">Give me something to do</ButtonLink>
    </Container>
  );
}
