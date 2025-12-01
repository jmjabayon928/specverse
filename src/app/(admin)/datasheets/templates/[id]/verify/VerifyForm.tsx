// src/app/(admin)/datasheets/templates/[id]/verify/VerifyForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VerifyForm(props: Readonly<{ sheetId: number }>) {
  const { sheetId } = props;

  const [action, setAction] = useState<"verify" | "reject" | "">("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (action === "reject" && comment.trim() === "") {
      alert("Rejection Comment is required.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/backend/templates/${sheetId}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sheetId,
          action,
          rejectionComment: comment,
        }),
      });

      const result = await res.json();

      if (res.ok) {
        router.push(`/datasheets/templates/${sheetId}`);
      } else {
        alert(result.error || "Verification failed");
      }
    } catch (err) {
      console.error("❌ Error during form submission:", err);
      alert("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 border-t pt-6">
      <fieldset className="mb-4">
        <legend className="block font-medium mb-2">Decision</legend>
        <div className="flex items-center gap-6">
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="action"
              value="verify"
              checked={action === "verify"}
              onChange={() => setAction("verify")}
              required
            />
            <span className="ml-2">Verify</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="action"
              value="reject"
              checked={action === "reject"}
              onChange={() => setAction("reject")}
              required
            />
            <span className="ml-2">Reject</span>
          </label>
        </div>
      </fieldset>

      {action === "reject" && (
        <div className="mb-4">
          <label htmlFor="rejectionComment" className="block font-medium mb-1">
            Rejection Comment
          </label>
          <textarea
            id="rejectionComment"
            name="rejectionComment"
            rows={3}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="Please provide the reason for rejection"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
      >
        {loading ? "Processing..." : "Submit"}
      </button>
    </form>
  );
}
