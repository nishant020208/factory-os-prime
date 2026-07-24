import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/goods-receipt")({
  head: () => ({ meta: [
    { title: "Goods Receipt — FactoryOS AI" },
    { name: "description", content: "Match POs against physical receipt" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Goods Receipt" sub="Match POs against physical receipt" />,
});
