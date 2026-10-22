import { Suspense } from "react";
import { CreateView } from "@/components/create/create-view";

export default function CreateNewPage() {
  return (
    <Suspense fallback={null}>
      <CreateView initialKind="post" />
    </Suspense>
  );
}
