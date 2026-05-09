"use client";

import { use } from "react";
import { redirect } from "next/navigation";

// Backwards-compat: old /project/[id] deeplinks now redirect into the SPA shell.
// Real chat experience lives at /project?team=<id>.
export default function ProjectIdRedirect(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  redirect(`/project?team=${encodeURIComponent(id)}`);
}
