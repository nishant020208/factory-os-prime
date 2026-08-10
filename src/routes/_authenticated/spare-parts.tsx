import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/spare-parts")({
  head: () => ({
    meta: [
      { title: "Spare Parts — FactoryOS AI" },
      { name: "description", content: "Spare parts inventory tied to machines" },
    ],
  }),
  component: () => (
    <StubModule eyebrow="Module" title="Spare Parts" sub="Spare parts inventory tied to machines" />
  ),
});
