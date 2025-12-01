// src/app/(admin)/datasheets/layouts/[layoutId]/preview/page.tsx
import PreviewClient from "./PreviewClient";

type RouteParams = Readonly<{ layoutId: string }>;
type PageProps   = Readonly<{ params: Promise<RouteParams> }>;

export default async function Page({ params }: PageProps) {
  const { layoutId } = await params; // Next 15: await params
  const id = Number(layoutId);

  if (!Number.isFinite(id) || id <= 0) {
    return <div className="p-6">Invalid layout id.</div>;
  }

  return <PreviewClient layoutId={id} />;
}