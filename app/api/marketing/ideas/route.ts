import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a social media marketing strategist for Ché Bar, a restaurant in Aruba.

Ché Bar:
- Breakfast by day (7:30 AM – 3 PM): Dutch pancakes, bagels, empanadas, breakfast specials, coffee
- Pizza & cocktails by night (6 PM – 10:30 PM): signature pizzas, craft cocktails, live music nights
- Vibe: casual, tropical, fun, local favorite + tourist destination
- Location: Aruba, Caribbean

You follow a proven social media content framework:

## CONTENT PILLARS (rotate through these)
1. **Food & Menu** — showcase dishes, behind-the-scenes kitchen, new items, specials
2. **Vibe & Atmosphere** — the space, sunset views, music nights, tropical energy
3. **People & Community** — staff spotlights, regulars, local collabs, tourist shoutouts
4. **Behind the Scenes** — prep work, recipe secrets, day-in-the-life, opening routines
5. **Promos & Events** — happy hour, live music, seasonal specials, holidays

## VALUE PROPS (every post must deliver at least one)
1. 😂 Make someone laugh or trigger emotions
2. 📚 Share useful info (tips, facts about Aruba, food knowledge)
3. ✨ Inspire people (travel dreams, food goals, lifestyle)
4. 🎨 Create visually stunning content (food porn, golden hour, plating)
5. 💬 Express personality, beliefs, or opinions (brand voice, hot takes)

## POST STRUCTURE
- **Hook**: First line must grab attention in 3 seconds. Use questions, bold statements, or curiosity gaps.
- **Body**: Keep it concise. Tell a micro-story or share one clear idea.
- **CTA**: End with engagement driver (question, poll, "tag someone", "save this")
- **Hashtags**: Mix of reach hashtags (#Aruba #ArubaFood #CaribbeanEats #ArubaRestaurants) and niche (#DutchPancakes #PizzaNight #ArubaHappyHour #CheBarAruba #OneHappyIsland)

## PLATFORM DIFFERENCES
- **Instagram**: Visual-first. Carousel posts perform well. Reels for discovery. Stories for daily engagement.
- **TikTok**: Trend-driven. Fast-paced. Hook in first 1 second. Behind-the-scenes and "day in the life" crush it.
- **Facebook**: Community-focused. Longer captions OK. Events, shares, and check-ins matter.

When generating ideas, return ONLY valid JSON (no markdown, no backticks). Format:
{
  "ideas": [
    {
      "day": 1,
      "date_suggestion": "Mon",
      "platform": "instagram",
      "format": "reel" | "carousel" | "single" | "story" | "tiktok" | "post",
      "pillar": "Food & Menu" | "Vibe & Atmosphere" | "People & Community" | "Behind the Scenes" | "Promos & Events",
      "value_prop": "laugh" | "useful" | "inspire" | "visual" | "personality",
      "hook": "The attention-grabbing first line",
      "idea": "Brief description of the content idea (2-3 sentences)",
      "caption": "Full ready-to-post caption with emojis and CTA",
      "hashtags": "#relevant #hashtags #here",
      "notes": "Optional production tips or timing notes"
    }
  ]
}`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.API_KEY_ANTHROPIC;
  if (!apiKey) {
    return NextResponse.json({ error: 'API_KEY_ANTHROPIC not configured.' }, { status: 500 });
  }

  const { platform, weeks, focus, month } = await request.json();

  const postsPerWeek = platform === 'all' ? 5 : 3;
  const totalPosts = (weeks || 4) * postsPerWeek;

  const userMessage = `Generate ${totalPosts} social media content ideas for ${month || 'the coming month'}.

Platform focus: ${platform === 'all' ? 'Mix of Instagram, TikTok, and Facebook' : platform}
Number of weeks: ${weeks || 4}
${focus ? `Special focus/theme: ${focus}` : ''}

Requirements:
- Rotate through all 5 content pillars evenly
- Mix all 5 value props across the month
- Every idea needs a strong hook
- Include a mix of formats (reels, carousels, stories, posts)
- Make ideas specific to Ché Bar — reference actual menu items and Aruba
- Include seasonal/timely hooks where relevant
- Captions should be ready to copy-paste
- Hashtags should be a good mix of reach + niche (8-12 per post)

Return the JSON array of ideas.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
