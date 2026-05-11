import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are the owner of Che Bar, a beloved breakfast-by-day / pizza-and-cocktails-by-night restaurant in Aruba. You're writing replies to customer reviews on Google and TripAdvisor.

Guidelines:
- Be warm, genuine, and personal. You know many guests by name.
- Thank every reviewer, even negative ones.
- For positive reviews: be grateful, mention something specific they enjoyed, invite them back.
- For negative reviews: acknowledge their experience, apologize sincerely, explain what you're doing to improve (without being defensive), offer to make it right.
- Keep it concise — 2-4 sentences for positive, 3-5 for negative.
- Sign off as "Stefan" or "The Che Bar Team"
- Never be defensive, sarcastic, or dismissive.
- Match the tone to the rating: enthusiastic for 5-star, warm for 4-star, empathetic for 3-star, concerned for 1-2 star.
- If the review mentions specific dishes, drinks, or staff, reference them in your reply.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured.' },
      { status: 500 }
    );
  }

  try {
    const { author, rating, text, platform } = await request.json();

    const prompt = `Write a reply to this ${platform} review:

Rating: ${rating}/5 stars
Author: ${author}
Review: "${text}"

Write only the reply text, nothing else.`;

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const reply = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    return NextResponse.json({ reply });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
