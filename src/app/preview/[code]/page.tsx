import { LinkPreview } from "@/components/preview";
export const metadata = { title: "Preview destination" };
export default async function PreviewPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  return <LinkPreview code={(await params).code} />;
}
