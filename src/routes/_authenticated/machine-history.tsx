import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/machine-history")({
  head: () => ({
    meta: [
      { title: "Machine History — FactoryOS AI" },
      { name: "description", content: "Full lifecycle of every asset" },
    ],
  }),
  component: () => (
    <StubModule eyebrow="Module" title="Machine History" sub="Full lifecycle of every asset" />
  ),
});
