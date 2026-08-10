import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/stock-movement")({
  head: () => ({
    meta: [
      { title: "Stock Movement — FactoryOS AI" },
      { name: "description", content: "Every stock in/out and location change" },
    ],
  }),
  component: () => (
    <StubModule
      eyebrow="Module"
      title="Stock Movement"
      sub="Every stock in/out and location change"
    />
  ),
});
