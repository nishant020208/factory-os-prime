import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/training")({
  head: () => ({ meta: [
    { title: "Training — FactoryOS AI" },
    { name: "description", content: "Course catalog, certifications and compliance" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Training" sub="Course catalog, certifications and compliance" />,
});
