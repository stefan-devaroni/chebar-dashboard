import { ReviewsClient } from '@/components/reviews-client';

export default function ReviewsPage() {
  const googleConnected = !!(
    process.env.GOOGLE_ACCOUNT_ID &&
    process.env.GOOGLE_LOCATION_ID &&
    process.env.GOOGLE_ACCESS_TOKEN
  );

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl">Reviews</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Manage Google and TripAdvisor reviews. Generate AI responses and post with one click.
        </p>
      </header>
      <ReviewsClient googleConnected={googleConnected} />
    </div>
  );
}
