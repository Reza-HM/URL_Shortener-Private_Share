import { Management } from "@/components/management";
export const metadata = { title: "Manage share" };
export default async function ManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <Management id={(await params).id} />;
}
