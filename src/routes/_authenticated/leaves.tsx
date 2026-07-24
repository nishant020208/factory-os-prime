import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/leaves")({
  head: () => ({ meta: [
    { title: "Leaves — FactoryOS AI" },
    { name: "description", content: "Leave requests, balances and approvals" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Leaves" sub="Leave requests, balances and approvals" />,
});
