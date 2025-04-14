"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import HomeComponent from "./Home";

export default function Home() {
  const router = useRouter();
  return (
    <div className="w-[60%] h-[100%] mx-auto" style={{ overflow: 'auto' }}>
      <HomeComponent />
    </div>
  );
}
