import { Workspace } from "@/components/workspace";
import { config } from "@/server/config";
export default function Home() {
  return <Workspace maxFileBytes={config().maxFileBytes} />;
}
