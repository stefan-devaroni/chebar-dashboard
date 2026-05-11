import { NextRequest, NextResponse } from 'next/server';

// Google Business Profile API integration
// Requires: GOOGLE_ACCOUNT_ID, GOOGLE_LOCATION_ID, GOOGLE_ACCESS_TOKEN in env
// Setup: https://developers.google.com/my-business/content/review-data

const BASE_URL = 'https://mybusiness.googleapis.com/v4';

export async function GET() {
  const accountId = process.env.GOOGLE_ACCOUNT_ID;
  const locationId = process.env.GOOGLE_LOCATION_ID;
  const accessToken = process.env.GOOGLE_ACCESS_TOKEN;

  if (!accountId || !locationId || !accessToken) {
    return NextResponse.json(
      { error: 'Google Business Profile not configured. Add GOOGLE_ACCOUNT_ID, GOOGLE_LOCATION_ID, and GOOGLE_ACCESS_TOKEN to .env.local.' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `${BASE_URL}/accounts/${accountId}/locations/${locationId}/reviews?pageSize=50`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        next: { revalidate: 300 },
      }
    );

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `Google API error: ${res.status} ${body}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const reviews = (data.reviews ?? []).map((r: any) => ({
      id: r.reviewId,
      platform: 'google',
      author: r.reviewer?.displayName ?? 'Anonymous',
      rating: r.starRating === 'FIVE' ? 5
        : r.starRating === 'FOUR' ? 4
        : r.starRating === 'THREE' ? 3
        : r.starRating === 'TWO' ? 2
        : r.starRating === 'ONE' ? 1
        : null,
      text: r.comment ?? '',
      date: r.createTime,
      hasReply: !!r.reviewReply,
      replyText: r.reviewReply?.comment ?? null,
      replyDate: r.reviewReply?.updateTime ?? null,
    }));

    return NextResponse.json({ reviews });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const accountId = process.env.GOOGLE_ACCOUNT_ID;
  const locationId = process.env.GOOGLE_LOCATION_ID;
  const accessToken = process.env.GOOGLE_ACCESS_TOKEN;

  if (!accountId || !locationId || !accessToken) {
    return NextResponse.json(
      { error: 'Google Business Profile not configured.' },
      { status: 500 }
    );
  }

  try {
    const { reviewId, replyText } = await request.json();

    const res = await fetch(
      `${BASE_URL}/accounts/${accountId}/locations/${locationId}/reviews/${reviewId}/reply`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment: replyText }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `Failed to post reply: ${res.status} ${body}` },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
