import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/rfq")({
  head: () => ({ meta: [
    { title: "Request for Quotation — FactoryOS AI" },
    { name: "description", content: "RFQs sent to suppliers and their responses" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Request for Quotation" sub="RFQs sent to suppliers and their responses" />,
});
