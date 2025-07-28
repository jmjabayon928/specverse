import React from "react";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl" | "full";
type Shape = "rectangle" | "circle";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: Size | string;   // e.g., "md" or "100px"
  height?: Size | string;  // e.g., "lg" or "2rem"
  shape?: Shape;
  animated?: boolean;
}

const sizeMap = {
  sm: "w-16 h-4",
  md: "w-32 h-6",
  lg: "w-48 h-8",
  xl: "w-64 h-10",
  full: "w-full h-full",
};

export function Skeleton({
  width = "md",
  height = "md",
  shape = "rectangle",
  animated = true,
  className,
  ...props
}: SkeletonProps) {
  const resolvedWidth = typeof width === "string" && sizeMap[width as Size] ? sizeMap[width as Size].split(" ")[0] : "";
  const resolvedHeight = typeof height === "string" && sizeMap[height as Size] ? sizeMap[height as Size].split(" ")[1] : "";

  return (
    <div
      className={cn(
        "bg-gray-200 dark:bg-gray-700",
        animated && "animate-pulse",
        typeof width === "string" && sizeMap[width as Size] ? resolvedWidth : `w-[${width}]`,
        typeof height === "string" && sizeMap[height as Size] ? resolvedHeight : `h-[${height}]`,
        shape === "circle" ? "rounded-full" : "rounded-md",
        className
      )}
      {...props}
    />
  );
}

export default Skeleton;
