import { PromotionReviewEditor } from "../../../../components/PromotionReviewEditor";

export default async function ReviewPromotionPage({
  params,
  searchParams,
}: {
  params: Promise<{ workId: string }>;
  searchParams: Promise<{ edition?: string }>;
}) {
  const [{ workId }, query] = await Promise.all([params, searchParams]);
  return (
    <PromotionReviewEditor
      initialEditionId={query.edition}
      workId={workId}
    />
  );
}
