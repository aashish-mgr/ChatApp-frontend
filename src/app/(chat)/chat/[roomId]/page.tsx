import { Suspense } from "react";
import { RoomPane } from "../../../../components/chat/RoomPane";
import { MessagePaneSkeleton } from "../../../../components/chat/Skeletons";

/**
 * `params` is unknown while prerendering (no `generateStaticParams` for
 * conversation ids), so it is resolved inside a Suspense boundary and handed
 * to a client component. See the Next.js dynamic route docs.
 */
export default function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  return (
    <Suspense fallback={<MessagePaneSkeleton />}>
      {params.then(({ roomId }) => <RoomPane roomId={roomId} />)}
    </Suspense>
  );
}
