import { PROXY_URL } from "./config.js";

/**
 * Builds the system prompt that gives Tower context on the user's actual
 * tasks, so its replanning advice is grounded in real data rather than
 * generic productivity platitudes.
 */
export function buildSystemPrompt(tasks, now) {
  const openTasks = tasks.filter((t) => t.status !== "done");
  const taskLines = openTasks
    .map((t) => {
      const hrsLeft = (t.due.getTime() - now.getTime()) / 36e5;
      return `- "${t.title}" (${t.category}, ${t.durationMin} min, due in ${hrsLeft.toFixed(1)}h, importance ${t.importance}/5)`;
    })
    .join("\n");

  return `You are Tower, the AI inside a deadline-management app called Departures. The app frames tasks like flight departures: each task has a "boarding window" before it's due.

Current time: ${now.toLocaleString()}.

The user's open tasks today:
${taskLines || "(no open tasks)"}

Your job: help the user replan, reprioritize, or think through their day when they ask. Be direct and concrete — give a specific suggested order or action, not vague encouragement. If they describe a constraint (e.g. "I'm sick", "I only have 2 hours", "my meeting got pushed"), reason about which tasks are now at risk and what you'd drop, delay, or compress. Keep responses under 120 words unless the user asks for detail. Do not invent tasks that aren't in the list above.`;
}

/**
 * Sends the conversation to the proxy and returns Tower's reply text.
 * Throws on network or API errors so the caller can show a fallback.
 */
export async function askTower(conversation, systemPrompt) {
  const response = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: conversation.map((m) => ({ role: m.role, content: m.content })),
      systemPrompt,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${response.status})`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((b) => b.type === "text");
  if (!textBlock) throw new Error("No response from Tower");
  return textBlock.text;
}
