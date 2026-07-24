import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/assigned-machines")({
  head: () => ({ meta: [
    { title: "My Machines — FactoryOS AI" },
    { name: "description", content: "Machines assigned to your shift" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="My Machines" sub="Machines assigned to your shift" />,
});
