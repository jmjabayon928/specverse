// src/app/(admin)/datasheets/templates/[id]/approve/ApproveButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Button from "@/components/ui/button/Button";

interface Props {
  sheetId: number;
}

export default function ApproveButton(props: Readonly<Props>) {
  const { sheetId } = props;

  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleApprove() {
    const confirmed = window.confirm("Are you sure you want to approve this template?");
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/backend/templates/${sheetId}/approve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Approval failed");

      toast.success("Template approved successfully");
      router.push(`/datasheets/templates/${sheetId}`);
    } catch (err) {
      console.error("Approval failed:", err);
      toast.error("Error approving template");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Button
      onClick={handleApprove}
      disabled={isSubmitting}
      className="mt-6 bg-green-600 hover:bg-green-700 text-white"
    >
      {isSubmitting ? "Approving..." : "Approve"}
    </Button>
  );
}
