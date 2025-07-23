"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Button from "@/components/ui/button/Button";

interface Props {
  sheetId: number;
}

export default function ApproveButton({ sheetId }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleApprove() {
    const confirmed = window.confirm("Are you sure you want to approve this filled datasheet?");
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/backend/filledsheets/${sheetId}/approve`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Approval failed");
      toast.success("Filled sheet approved successfully");
      router.push(`/datasheets/filled/${sheetId}?success=approved`);
    } catch (err) {
      console.error("❌ Approval failed:", err);
      toast.error("Error approving filled sheet");
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
