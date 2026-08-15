import { EditorialResearchEditor } from "../../../../components/EditorialResearchEditor";

export default async function EditorialResearchPage({
  params,
}: {
  params: Promise<{ workId: string }>;
}) {
  const { workId } = await params;
  return <EditorialResearchEditor workId={workId} />;
}
