import { WorkDetail } from "../../../components/WorkDetail";

export default async function WorkPage({
  params,
}: {
  params: Promise<{ workId: string }>;
}) {
  const { workId } = await params;
  return <WorkDetail workId={workId} />;
}
