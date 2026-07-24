import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({ meta: [
    { title: "My Orders — FactoryOS AI" },
    { name: "description", content: "Your purchase orders and delivery status" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="My Orders" sub="Your purchase orders and delivery status" />,
});
