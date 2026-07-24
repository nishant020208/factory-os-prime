import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/receiving")({
  head: () => ({ meta: [
    { title: "Receiving — FactoryOS AI" },
    { name: "description", content: "Goods inward and receiving inspection" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Receiving" sub="Goods inward and receiving inspection" />,
});
