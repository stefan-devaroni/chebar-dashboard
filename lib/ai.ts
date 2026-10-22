// The Claude model behind every AI feature in the dashboard: review replies, report chat
// and analysis, emailed Revel PDFs, and marketing. When Anthropic retires a model, change it
// here once (dates: https://platform.claude.com/docs/en/about-claude/model-deprecations).
//
// This model thinks before it answers, and that thinking counts toward each request's
// max_tokens. The routes keep it short with output_config effort 'low'.
export const AI_MODEL = 'claude-sonnet-5-5';

// Shown when Claude declines a request (stop_reason 'refusal').
export const AI_REFUSAL_ERROR = 'Claude declined to answer this one. Try rewording it.';
