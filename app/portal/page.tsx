import type { ApiUser } from "@/types";
import { Suspense } from "react";
import { apiFetch } from "@/lib/api/apiFetch";

async function UserName() {
  const user = await apiFetch<ApiUser>("/users/me");
  return <div>Client Gallery for: {user.name}</div>;
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UserName />
    </Suspense>
  );
}
