import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/scheduling")({
  head: () => ({ meta: [
    { title: "Scheduling — FactoryOS AI" },
    { name: "description", content: "Shift, resource and machine scheduling" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Scheduling" sub="Shift, resource and machine scheduling" />,
});
