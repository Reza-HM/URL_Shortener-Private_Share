import { Recipient } from "@/components/recipient";
export const metadata = { title: "Private Drop" };
export default async function DropPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <Recipient id={(await params).id} />;
}
