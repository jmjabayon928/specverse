import { useState, useEffect } from "react";
import { Estimation } from "@/types/estimation";

export function useEstimationData() {
    const [data, setData] = useState<Estimation[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch("/api/backend/estimation/all");
                const json = await res.json();
                setData(Array.isArray(json) ? json : []);
            } catch (err) {
                console.error(err);
                setData([]);
            } finally {
                setLoading(false);               // ✅ you forgot this!
            }
        }

        fetchData();
    }, []);

    return { data, loading };
}
