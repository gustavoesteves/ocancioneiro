import { EditionMetadataEditor } from "../../../../components/EditionMetadataEditor";

export default async function EditEditionPage({
  params,
}: {
  params: Promise<{ workId: string }>;
}) {
  const { workId } = await params;
  return <EditionMetadataEditor workId={workId} />;
}
