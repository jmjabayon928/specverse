// src/components/dashboard/ActiveUsersByRole.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A28DFF"];

type UserRoleData = {
  roleName: string;
  total: number;
};

type RawUserRoleData = {
  RoleName: string;
  Total: number;
};

const ActiveUsersByRole: React.FC = () => {
  const [data, setData] = useState<UserRoleData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/backend/stats/active-users-by-role");
        if (!res.ok) throw new Error("Failed to fetch active users by role");

        const json: RawUserRoleData[] = await res.json();

        const mapped: UserRoleData[] = json.map((item) => ({
          roleName: item.RoleName,
          total: item.Total,
        }));

        console.log("Active users by role chart data:", mapped);
        setData(mapped);
      } catch (error) {
        console.error("Active users by role fetch error:", error);
      }
    };
    fetchData();
  }, []);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="roleName"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default ActiveUsersByRole;
