import { useEffect, useState } from "react";
import type { GlobalFilter, QueryPlan } from "../../shared/types.js";
import { api } from "../lib/api.js";

/** How long a query sits still before it is compiled, so typing is not narrated. */
const SETTLE_MS = 250;

interface QueryPreviewProps {
  query: string;
  globalFilters: GlobalFilter[];
}

/**
 * What a section's query comes to: the searches GitHub is sent, each a link to
 * run it there, and whatever the query asks of the results afterwards.
 */
export function QueryPreview({ query, globalFilters }: QueryPreviewProps) {
  const [plan, setPlan] = useState<QueryPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let listening = true;
    const timer = setTimeout(() => {
      api
        .explainQuery(query, globalFilters)
        .then((compiled) => {
          if (!listening) return;
          setPlan(compiled);
          setError(null);
        })
        .catch((caught: unknown) => {
          if (!listening) return;
          setPlan(null);
          setError(caught instanceof Error ? caught.message : String(caught));
        });
    }, SETTLE_MS);

    return () => {
      listening = false;
      clearTimeout(timer);
    };
  }, [query, globalFilters]);

  if (error) return <p className="mt-1.5 text-[11px] text-rose-600 dark:text-rose-400">{error}</p>;
  if (!plan) return null;

  return (
    <div className="mt-1.5 space-y-0.5 text-[10px] leading-relaxed">
      <p className="uppercase tracking-wide text-ink-400 dark:text-ink-500">
        {plan.searches.length === 1 ? "Runs as" : `Runs as ${plan.searches.length} searches, unioned`}
      </p>

      {plan.searches.map((search) => (
        <p key={search.query} className="break-words">
          <a
            href={`https://github.com/search?type=pullrequests&q=${encodeURIComponent(search.query)}`}
            target="_blank"
            rel="noreferrer"
            title="Run this search on GitHub"
            className="font-mono text-ink-500 hover:text-sheen-600 hover:underline dark:text-ink-400 dark:hover:text-sheen-400"
          >
            {search.query}
          </a>
          {search.keptLocally.length > 0 && (
            <span className="text-ink-400 dark:text-ink-500">
              , then keeps only <span className="font-mono">{search.keptLocally.join(" ")}</span>
            </span>
          )}
        </p>
      ))}

      {plan.warnings.map((warning) => (
        <p key={warning} className="text-amber-600 dark:text-amber-500">
          {warning}
        </p>
      ))}
    </div>
  );
}
