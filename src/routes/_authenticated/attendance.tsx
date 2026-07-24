import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [
    { title: "Attendance — FactoryOS AI" },
    { name: "description", content: "Daily attendance, biometrics and shifts" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Attendance" sub="Daily attendance, biometrics and shifts" />,
});
