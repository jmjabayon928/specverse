// src/app/(admin)/datasheets/layouts/[layoutId]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { LayoutBundle } from "@/domain/layouts/layoutTypes";

interface PageProps {
  readonly params: Promise<{ readonly layoutId: string }>;
}

function toPositiveInt(s: string): number | null {
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return Math.trunc(n);
}

function labelFromId(id: number | null): string {
  return id === null ? "—" : `#${id}`;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.BACKEND_URL ??
  "http://localhost:5000";

export default async function LayoutDetailPage({ params }: Readonly<PageProps>) {
  const { layoutId } = await params;
  const id = toPositiveInt(layoutId);
  if (id === null) {
    notFound();
  }

  // Forward auth headers to backend (supports cookie/session or Authorization)
  const incoming = await headers();
  const cookie = incoming.get("cookie") ?? "";
  const auth = incoming.get("authorization") ?? "";
  const forwardHeaders: HeadersInit = {};
  if (cookie) forwardHeaders["cookie"] = cookie;
  if (auth) forwardHeaders["authorization"] = auth;

  const url = `${API_BASE}/api/backend/layouts/${id}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: forwardHeaders,
  });

  if (res.status === 404) {
    notFound();
  }
  if (!res.ok) {
    return (
      <div className="container max-w-5xl py-6">
        <h1 className="text-2xl font-semibold mb-4">Layout #{id}</h1>
        <p className="text-red-600">Failed to load layout details. Status {res.status}.</p>
        <p className="text-xs text-gray-500 mt-2">Tried: {url}</p>
      </div>
    );
  }

  const bundle = (await res.json()) as LayoutBundle;
  const meta = bundle?.meta;
  if (!meta) {
    return (
      <div className="container max-w-5xl py-6">
        <h1 className="text-2xl font-semibold mb-4">Layout #{id}</h1>
        <p className="text-red-600">Loaded, but response has no meta.</p>
      </div>
    );
  }

  const templateLabel = labelFromId(meta.templateId ?? null);
  const clientLabel = labelFromId(meta.clientId ?? null);

  return (
    <div className="container max-w-5xl py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Layout #{id}</h1>
        <div className="flex gap-2">
          <Link
            href={`/datasheets/layouts/${id}/builder`}
            className="rounded border px-3 py-2"
            aria-label="Open Builder"
            title="Open Builder"
          >
            Open Builder
          </Link>
        </div>
      </div>

      <section aria-labelledby="meta-heading" className="border rounded mb-6">
        <h2 id="meta-heading" className="px-4 py-3 border-b bg-gray-50 text-lg font-medium">
          Meta
        </h2>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Template (SheetID)</div>
            <div className="font-medium">{templateLabel}</div>
          </div>
          <div>
            <div className="text-gray-500">Client</div>
            <div className="font-medium">{clientLabel}</div>
          </div>
          <div>
            <div className="text-gray-500">Paper</div>
            <div className="font-medium">
              {meta.paperSize} / {meta.orientation}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Grid</div>
            <div className="font-medium">
              {meta.gridCols} cols, gap {meta.gridGapMm}mm
            </div>
          </div>
          <div>
            <div className="text-gray-500">Version</div>
            <div className="font-medium">{meta.version ?? 1}</div>
          </div>
          <div>
            <div className="text-gray-500">Default</div>
            <div className="font-medium">{meta.isDefault ? "Yes" : "No"}</div>
          </div>
        </div>
      </section>

      <section aria-labelledby="regions-heading" className="border rounded">
        <h2 id="regions-heading" className="px-4 py-3 border-b bg-gray-50 text-lg font-medium">
          Regions & Blocks
        </h2>

        {bundle.regions.length === 0 ? (
          <div className="p-4 text-gray-600 text-sm">No regions.</div>
        ) : (
          <div className="divide-y">
            {bundle.regions.map((region) => {
              const blocks = bundle.blocks.filter((b) => b.regionId === region.regionId);

              return (
                <div key={region.regionId} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-base font-medium">{region.name}</div>
                      <div className="text-xs text-gray-500">Kind: {region.kind}</div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {blocks.length} {blocks.length === 1 ? "block" : "blocks"}
                    </div>
                  </div>

                  {blocks.length === 0 ? (
                    <div className="text-sm text-gray-500">No blocks in this region.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="text-left bg-gray-50">
                          <tr>
                            <th className="px-3 py-2">BlockID</th>
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">Source</th>
                            <th className="px-3 py-2">Pos (x,y)</th>
                            <th className="px-3 py-2">Size (w,h)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {blocks.map((b) => {
                            let source = "—";
                            if (b.blockType === "Subsheet" && typeof b.sourceRef?.SubID === "number") {
                              source = `SubID ${b.sourceRef.SubID}`;
                            } else if (
                              b.blockType === "Field" &&
                              typeof b.sourceRef?.InfoTemplateID === "number"
                            ) {
                              source = `InfoTemplateID ${b.sourceRef.InfoTemplateID}`;
                            } else if (b.blockType === "Image" && b.sourceRef?.imageKind) {
                              source = b.sourceRef.imageKind;
                            }

                            return (
                              <tr key={b.blockId} className="border-t">
                                <td className="px-3 py-2 font-mono">#{b.blockId}</td>
                                <td className="px-3 py-2">{b.blockType}</td>
                                <td className="px-3 py-2">{source}</td>
                                <td className="px-3 py-2">
                                  {b.x},{b.y}
                                </td>
                                <td className="px-3 py-2">
                                  {b.w},{b.h}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
