import { useState, useEffect } from "react";
import { Estimation } from "@/domain/estimations/estimationTypes";

export function useEstimationData() {
  const [data, setData] = useState<Estimation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";
        const res = await fetch(`${baseUrl}/api/backend/estimation`);
        const json = await res.json();
        setData(Array.isArray(json) ? json : []);
      } catch (err) {
        console.error("Failed to fetch estimations:", err);
        setData([]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { data, loading };
}
