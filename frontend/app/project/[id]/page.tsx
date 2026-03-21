"use client";
import { use } from "react";
import { redirect } from "next/navigation";

export default function ProjectRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  redirect(`/project?id=${id}`);
}
