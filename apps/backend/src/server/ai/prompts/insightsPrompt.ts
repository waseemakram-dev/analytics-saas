import { AnalyticsGroundingContext, AiLanguage, InsightType } from "../types/ai.types";

export class InsightsPromptBuilder {
  /**
   * System Prompt enforcing zero hallucinations, strict numeric fidelity,
   * and clean JSON formatting.
   */
  static getSystemPrompt(language: AiLanguage): string {
    const languageInstruction =
      language === "roman-ur"
        ? `LANGUAGE REQUIREMENT: Output prose, explanations, and recommendations in natural, professional Roman Urdu (e.g., "Aapki website par pichle 30 dino mein kul 150 sessions record hue hain..."). Keep all metric names (Sessions, Active Users, Bounce Rate, Engagement Rate, Organic Search, etc.), numbers, URLs, and fact IDs in their original English technical form.`
        : `LANGUAGE REQUIREMENT: Output in clear, professional, executive-level English tailored for non-technical website owners and marketing managers.`;

    return `You are the Lead Marketing Analytics AI for an enterprise SaaS platform.
Your task is to analyze verified Google Analytics 4 (GA4) data and generate high-impact, actionable insights.

CRITICAL ZERO-HALLUCINATION RULES:
1. NEVER invent or fabricate any metric, number, session count, user count, or percentage.
2. Every number you mention MUST originate directly from the verified facts provided in the user context.
3. If total traffic is 0 or low, state this honestly. Do not invent reasons (like Google algorithm penalties or server errors) unless explicitly stated in the context.
4. Distinguish clearly between:
   - OBSERVED FACTS (what the data proves)
   - HYPOTHESES (potential marketing reasons)
   - ACTIONABLE RECOMMENDATIONS (what the business owner should do next).
5. For each insight, cite the relevant 'factReferences' (e.g., ["fact_total_sessions", "fact_engagement_rate"]).
6. Output MUST strictly be valid JSON matching this schema:
{
  "summary": "Executive summary paragraph(s)",
  "insights": [
    {
      "type": "traffic" | "acquisition" | "engagement" | "content" | "events" | "general",
      "severity": "info" | "positive" | "warning" | "critical",
      "title": "Concise headline",
      "explanation": "Evidence-grounded explanation citing verified metrics",
      "factReferences": ["fact_id_1", "fact_id_2"],
      "recommendations": ["Actionable next step 1", "Actionable next step 2"]
    }
  ],
  "limitations": ["Data limitation notes if any"]
}

${languageInstruction}
Do not include markdown code block backticks (like \`\`\`json) in your response. Return pure JSON only.`;
  }

  /**
   * Compact verified context prompt.
   */
  static getUserPrompt(context: AnalyticsGroundingContext, focus?: InsightType): string {
    const focusInstruction = focus
      ? `\nFOCUS AREA: Prioritize insights specifically relevant to '${focus}'.`
      : "";

    const factsFormatted = context.facts
      .map((f) => `- [${f.factId}] ${f.label}: ${f.formattedValue}`)
      .join("\n");

    const anomaliesFormatted =
      context.anomalies.length > 0
        ? context.anomalies
            .map((a) => `- [${a.severity.toUpperCase()}] ${a.title}: ${a.description}`)
            .join("\n")
        : "No statistical anomalies detected.";

    const channelsFormatted =
      context.channels.length > 0
        ? context.channels
            .map(
              (c) =>
                `- Channel: ${c.channelGroup} | Sessions: ${c.sessions} | Users: ${c.activeUsers} | Engagement: ${c.engagementRate}% | Conversions: ${c.conversions}`
            )
            .join("\n")
        : "No channel breakdown available.";

    const pagesFormatted =
      context.topPages.length > 0
        ? context.topPages
            .map(
              (p) =>
                `- Page: ${p.pagePath} ("${p.pageTitle}") | Views: ${p.screenPageViews} | Users: ${p.activeUsers} | Avg Time: ${p.averageEngagementTime}s`
            )
            .join("\n")
        : "No page breakdown available.";

    return `VERIFIED GA4 ANALYTICS CONTEXT:
Property: ${context.displayName} (ID: ${context.propertyId})
Timezone: ${context.timeZone} | Currency: ${context.currencyCode}
Date Range: ${context.dateRange.startDate} to ${context.dateRange.endDate} (${context.dateRange.label})
Data Sync Time: ${context.dataFetchedAt}
${focusInstruction}

VERIFIED DETERMINISTIC FACTS (USE ONLY THESE FIGURES):
${factsFormatted}

STATISTICAL ANOMALY DETECTIONS:
${anomaliesFormatted}

TOP TRAFFIC CHANNELS:
${channelsFormatted}

TOP CONTENT / PAGES:
${pagesFormatted}

DATA LIMITATIONS:
${context.limitations.length > 0 ? context.limitations.join("; ") : "None"}

Please evaluate these verified metrics and return the structured JSON insights.`;
  }
}
