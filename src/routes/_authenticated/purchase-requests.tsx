import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/purchase-requests")({
  head: () => ({ meta: [
    { title: "Purchase Requests — FactoryOS AI" },
    { name: "description", content: "Internal requests to procurement" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Purchase Requests" sub="Internal requests to procurement" />,
});
