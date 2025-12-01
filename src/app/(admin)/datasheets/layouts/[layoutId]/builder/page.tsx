// src/app/(admin)/datasheets/layouts/[layoutId]/builder/page.tsx
import { notFound } from "next/navigation";
import BuilderClient from "./BuilderClient";

interface PageProps {
  readonly params: Promise<{ readonly layoutId: string }>;
}

export default async function BuilderPage({ params }: Readonly<PageProps>) {
  const { layoutId } = await params;
  const id = Number(layoutId);
  if (!Number.isFinite(id) || id <= 0) notFound();
  return <BuilderClient layoutId={id} />;
}
