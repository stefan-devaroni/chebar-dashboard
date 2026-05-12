import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a social media marketing expert for Ché Bar, a restaurant in Aruba.

Ché Bar is:
- Breakfast by day (7:30 AM – 3 PM): Dutch pancakes, bagels, empanadas, breakfast specials
- Pizza & cocktails by night (6 PM – 10:30 PM): signature pizzas, craft cocktails, live music
- Vibe: casual, tropical, fun, local favorite + tourist spot
- Location: Aruba (Caribbean island)

When generating content:
- Keep captions engaging, fun, and on-brand
- Use relevant emojis but don't overdo it
- Include 3-5 relevant hashtags at the end
- Adapt tone to the platform (Instagram = visual/aesthetic, Facebook = community/share, TikTok = trendy/fun)
- Mention specific menu items when relevant
- Reference the Aruba/Caribbean lifestyle
- Keep it concise — Instagram captions under 150 words, TikTok under 80 words`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.API_KEY_ANTHROPIC;
  if (!apiKey) {
    return NextResponse.json({ error: 'API_KEY_ANTHROPIC not configured.' }, { status: 500 });
  }

  const { prompt, platform, contentType } = await request.json();

  const userMessage = `Generate a ${contentType || 'post caption'} for ${platform || 'Instagram'}.

Topic/idea: ${prompt}

Return ONLY the caption text, nothing else. No explanations or alternatives.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    return NextResponse.json({ content: text });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
