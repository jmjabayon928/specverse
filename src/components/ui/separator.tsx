// src/components/ui/separator.tsx

import * as React from "react";

export function Separator(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="separator"
      className={`my-4 h-px w-full bg-muted ${props.className || ""}`}
      {...props}
    />
  );
}
