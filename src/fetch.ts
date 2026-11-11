/** Read contribution totals, streak and languages from the GitHub GraphQL API. */
import type { Lang, RepoLang, Stats } from "./model.js";
import { languageColor, rawLanguageColor } from "./palette.js";

const API = "https://api.github.com/graphql";

export class FetchError extends Error {}

async function gql(query: string, variables: Record<string, unknown>, token: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "git-butterfly",
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (e) {
    throw new FetchError(`Could not reach GitHub: ${(e as Error).message}`);
  }
  if (!res.ok) throw new FetchError(`GitHub API returned HTTP ${res.status}. Is the token valid?`);
  const json: any = await res.json();
  if (json.errors?.length) throw new FetchError(json.errors.map((e: any) => e.message).join("; "));
  return json.data;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** days: [YYYY-MM-DD, count]. A streak survives if today has no activity *yet*. */
export function currentStreak(days: Array<[string, number]>, today: Date = new Date()): number {
  const counts = new Map(days);
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (!((counts.get(dayKey(cursor)) ?? 0) > 0)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while ((counts.get(dayKey(cursor)) ?? 0) > 0) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/** Count the user's own (non-fork) repositories per main language, across all pages. */
async function fetchRepoLanguages(login: string, token: string): Promise<RepoLang[]> {
  const counts = new Map<string, RepoLang>();
  let cursor: string | null = null;
  for (let page = 0; page < 20; page++) {
    const data: any = await gql(
      "query($login:String!,$after:String){user(login:$login){repositories(first:100, after:$after, " +
        "ownerAffiliations:OWNER, isFork:false){pageInfo{hasNextPage endCursor} nodes{primaryLanguage{name color}}}}}",
      { login, after: cursor },
      token,
    );
    const repos = data.user.repositories;
    for (const node of repos.nodes) {
      const lang = node.primaryLanguage;
      if (!lang) continue;
      const entry = counts.get(lang.name) ?? { name: lang.name, color: rawLanguageColor(lang.name, lang.color), count: 0 };
      entry.count++;
      counts.set(lang.name, entry);
    }
    if (!repos.pageInfo.hasNextPage) break;
    cursor = repos.pageInfo.endCursor;
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function fetchStats(login: string, token: string): Promise<Stats> {
  const first = await gql(
    "query($login:String!){user(login:$login){contributionsCollection{contributionYears}}}",
    { login },
    token,
  );
  if (!first.user) throw new FetchError(`GitHub user '${login}' was not found.`);
  const years: number[] = first.user.contributionsCollection.contributionYears;

  const parts = years.map(
    (y) =>
      `y${y}: contributionsCollection(from:"${y}-01-01T00:00:00Z", to:"${y}-12-31T23:59:59Z"){` +
      "contributionCalendar{totalContributions} " +
      "commitContributionsByRepository(maxRepositories:100){" +
      "contributions{totalCount} repository{primaryLanguage{name color}}}}",
  );
  parts.push("recent: contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount}}}}");
  const { user } = await gql("query($login:String!){user(login:$login){" + parts.join(" ") + "}}", { login }, token);

  let total = 0;
  const weights = new Map<string, number>();
  const colors = new Map<string, string | null>();
  for (const y of years) {
    const block = user[`y${y}`];
    total += block.contributionCalendar.totalContributions;
    for (const item of block.commitContributionsByRepository) {
      const lang = item.repository.primaryLanguage;
      if (lang) {
        weights.set(lang.name, (weights.get(lang.name) ?? 0) + item.contributions.totalCount);
        colors.set(lang.name, lang.color);
      }
    }
  }

  if (!weights.size) {
    // No commits found: fall back to the bytes of code in the user's own repositories.
    const data = await gql(
      "query($login:String!){user(login:$login){repositories(first:100, ownerAffiliations:OWNER, " +
        "isFork:false, orderBy:{field:PUSHED_AT, direction:DESC}){nodes{languages(first:8, " +
        "orderBy:{field:SIZE, direction:DESC}){edges{size node{name color}}}}}}}",
      { login },
      token,
    );
    for (const repo of data.user.repositories.nodes) {
      for (const edge of repo.languages.edges) {
        weights.set(edge.node.name, (weights.get(edge.node.name) ?? 0) + edge.size);
        colors.set(edge.node.name, edge.node.color);
      }
    }
  }

  const days: Array<[string, number]> = [];
  for (const week of user.recent.contributionCalendar.weeks)
    for (const d of week.contributionDays) days.push([d.date, d.contributionCount]);

  const languages: Lang[] = [...weights].map(([name, weight]) => ({
    name,
    color: languageColor(name, colors.get(name)),
    weight,
  }));
  const repoLanguages = await fetchRepoLanguages(login, token);
  return { login, total, streak: currentStreak(days), languages, repoLanguages };
}
