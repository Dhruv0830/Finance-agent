// frontend/app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  // If proxy.ts passes through to '/', automatically send to /signup
  redirect("/signup");
}
