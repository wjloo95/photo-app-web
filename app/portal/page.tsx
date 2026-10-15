import { ApiUser } from "@/types";
import { Suspense } from "react";
async function UserName() {
  const result = await fetch(`${process.env.API_URL}/users/me`);
  const user: ApiUser = await result.json();

  return <div>Client Gallery for: {user.name}</div>;
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UserName />
    </Suspense>
  );
}
