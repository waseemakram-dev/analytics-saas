"use client";

import React, { useState } from "react";
import { Info, HelpCircle } from "lucide-react";

export const METRIC_DEFINITIONS: Record<string, { title: string; description: string; advice?: string }> = {
  activeUsers: {
    title: "Active Users",
    description:
      "The number of unique individuals who visited your site and engaged with it for at least 10 seconds, had 2+ page views, or completed a conversion. This is GA4's primary metric for real audience size.",
    advice: "Focus on this over total users because it filters out immediate accidental bounces.",
  },
  totalUsers: {
    title: "Total Users",
    description:
      "The total count of unique visitors who logged any event on your site during the selected date range, including those who bounced immediately.",
  },
  newUsers: {
    title: "New Users",
    description:
      "The number of visitors who interacted with your site for the very first time. GA4 tracks this via the first_open or first_visit event.",
    advice: "High new users indicate strong acquisition channels (ads, SEO, or social campaigns).",
  },
  sessions: {
    title: "Sessions",
    description:
      "The total number of browsing periods initiated on your site. A session begins when a user opens your site and ends after 30 minutes of inactivity.",
  },
  screenPageViews: {
    title: "Page Views / Screen Views",
    description:
      "The total number of web pages or app screens your visitors viewed. Repeated views of a single page are counted each time.",
  },
  engagementRate: {
    title: "Engagement Rate",
    description:
      "The percentage of sessions that were considered 'engaged' (lasted longer than 10 seconds, had a conversion event, or had at least 2 page views).",
    advice: "A healthy engagement rate for B2B SaaS is typically 50%–70%.",
  },
  bounceRate: {
    title: "Bounce Rate (GA4)",
    description:
      "The exact inverse of Engagement Rate (100% minus Engagement Rate). It measures the percentage of sessions where users did NOT stay for 10 seconds, view multiple pages, or convert.",
    advice: "Unlike Universal Analytics, a 40% bounce rate in GA4 simply means 60% of visitors engaged meaningfully.",
  },
  averageSessionDuration: {
    title: "Avg Session Duration",
    description:
      "The total duration of all user engagement time divided by the total number of sessions, represented in minutes and seconds.",
  },
  eventCount: {
    title: "Event Count",
    description:
      "The total number of interactions recorded on your site (e.g., page_view, scroll, click, session_start, file_download, form_submit).",
  },
  conversions: {
    title: "Conversions / Key Events",
    description:
      "The count of high-value actions marked as key events in your Google Analytics 4 property (such as signups, purchases, or quote requests).",
    advice: "Make sure you configure primary business goals in GA4 to populate this metric.",
  },
  direct: {
    title: "Direct Traffic",
    description:
      "Visitors who typed your URL directly into their browser, clicked a bookmark, or clicked an untracked link in an email or document.",
  },
  organicSearch: {
    title: "Organic Search",
    description:
      "Visitors who found your website by clicking an unpaid organic result on search engines like Google, Bing, or Yahoo.",
  },
  referral: {
    title: "Referral Traffic",
    description:
      "Visitors who arrived at your site by clicking a link on another website (blogs, directories, news articles, partners).",
  },
  organicSocial: {
    title: "Organic Social",
    description:
      "Visitors referred from unpaid posts, profiles, or bio links on social networks like LinkedIn, Twitter/X, Facebook, and Instagram.",
  },
  unassigned: {
    title: "Unassigned Traffic",
    description:
      "Traffic that GA4 cannot categorize into standard channel rules, often due to missing UTM parameters or custom campaign tags.",
  },
};

interface MetricTooltipProps {
  metricKey: string;
  className?: string;
}

export function MetricTooltip({ metricKey, className = "" }: MetricTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const def = METRIC_DEFINITIONS[metricKey];

  if (!def) return null;

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-0.5 rounded focus:outline-none"
        aria-label={`What is ${def.title}?`}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div
          role="tooltip"
          className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-gray-900 text-white dark:bg-gray-800 dark:border dark:border-gray-700 text-xs rounded-lg shadow-xl pointer-events-none transition-opacity animate-in fade-in"
        >
          <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            {def.title}
          </div>
          <p className="text-gray-300 leading-relaxed">{def.description}</p>
          {def.advice && (
            <div className="mt-2 pt-2 border-t border-gray-700 text-indigo-300 text-[11px] font-medium">
              💡 Tip: {def.advice}
            </div>
          )}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800" />
        </div>
      )}
    </div>
  );
}
