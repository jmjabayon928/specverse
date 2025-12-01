// src/app/(admin)/datasheets/layouts/[layoutId]/subsheetbuilder/[subId]/page.tsx
import SubsheetBuilderClient from "./SubsheetBuilderClient";

type PageParams = Readonly<{ layoutId: string; subId: string }>;
type PageProps = Readonly<{ params: Promise<PageParams> }>;

export default async function Page({ params }: PageProps) {
  const { layoutId, subId } = await params;   // ← await the promise
  return <SubsheetBuilderClient layoutId={layoutId} subId={subId} />;
}