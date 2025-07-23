import { cookies } from "next/headers";

export default async function TestCookiesPage() {
  const cookieStore = await cookies(); // ✅ This will now be typed correctly

  const test = cookieStore.get("user");

  return (
    <div>
      <h1>Cookie Test</h1>
      <p>User: {test?.value ?? "None"}</p>
    </div>
  );
}
