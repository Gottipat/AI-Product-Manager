import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type AnalysisMode = 'general' | 'product_manager';

interface MeetingExpectations {
  mustIncludeItemTitles?: string[];
  mustNotIncludeItemTitles?: string[];
  mustIncludeSummaryPhrases?: string[];
}

interface ScenarioMeeting {
  sequenceNumber: number;
  slug: string;
  title: string;
  transcriptPath: string;
  analysisMode?: AnalysisMode;
  contextNote?: string;
  expectations?: MeetingExpectations;
}

interface FinalProjectExpectations {
  mustHaveItemStatuses?: Array<{
    titleLike: string;
    status: string;
  }>;
  mustNotHaveOpenTitles?: string[];
}

interface BenchmarkScenario {
  schemaVersion: string;
  scenarioId: string;
  displayName: string;
  project: {
    name: string;
    description?: string;
    isRecurring?: boolean;
  };
  defaultAnalysisMode?: AnalysisMode;
  defaultContextNote?: string;
  meetings: ScenarioMeeting[];
  finalProjectExpectations?: FinalProjectExpectations;
}

interface ExpectationResult {
  category:
    | 'meeting_item_presence'
    | 'meeting_item_absence'
    | 'meeting_summary_phrase'
    | 'project_item_status'
    | 'project_open_absence';
  target: string;
  passed: boolean;
  details?: string;
}

interface BenchmarkMeetingReport {
  sequenceNumber: number;
  slug: string;
  title: string;
  meetingId?: string | undefined;
  uploadStatus: number;
  transcriptEventCount?: number | undefined;
  momGeneration?:
    | {
        success?: boolean | undefined;
        momId?: string | null | undefined;
        itemsCreated?: number | undefined;
        highlightsCreated?: number | undefined;
        processingTimeMs?: number | undefined;
        error?: string | undefined;
      }
    | undefined;
  executiveSummary?: string | undefined;
  detailedSummary?: string | undefined;
  itemSnapshot: Array<{
    itemType: string;
    title: string;
    status: string | null;
    assignee: string | null;
    priority: string | null;
  }>;
  expectationResults: ExpectationResult[];
}

interface ProjectItemSnapshot {
  id: string;
  meetingId: string;
  itemType: string;
  title: string;
  status: string | null;
  assignee: string | null;
  priority: string | null;
}

interface BenchmarkReport {
  scenario: {
    scenarioId: string;
    displayName: string;
    schemaVersion: string;
    sourcePath: string;
  };
  run: {
    startedAt: string;
    finishedAt: string;
    apiBaseUrl: string;
    reportPath: string;
    projectId?: string | undefined;
    projectName?: string | undefined;
    health?: unknown | undefined;
  };
  summary: {
    meetingsProcessed: number;
    checksPassed: number;
    checksFailed: number;
  };
  meetings: BenchmarkMeetingReport[];
  finalProjectChecks: ExpectationResult[];
  finalProjectSnapshot?:
    | {
        project?: unknown | undefined;
        meetings?: unknown[] | undefined;
        items?: ProjectItemSnapshot[] | undefined;
        stats?: unknown | undefined;
      }
    | undefined;
}

interface ApiResponse<T> {
  status: number;
  payload: T;
}

interface UploadedMeetingResponse {
  success: boolean;
  meetingId: string;
  meetingStartTime: string;
  transcriptEventsCreated: number;
  momGeneration: {
    success: boolean;
    momId: string | null;
    highlightsCreated: number;
    itemsCreated: number;
    processingTimeMs: number;
    error?: string | undefined;
  };
}

interface MeetingMomResponse {
  mom?:
    | {
        executiveSummary?: string | null | undefined;
        detailedSummary?: string | null | undefined;
      }
    | undefined;
}

interface MeetingItemsResponse {
  items?:
    | Array<{
        id: string;
        meetingId: string;
        itemType: string;
        title: string;
        status: string | null;
        assignee: string | null;
        priority: string | null;
      }>
    | undefined;
}

interface ProjectStateResponse {
  project?: unknown | undefined;
  meetings?: unknown[] | undefined;
  items?: ProjectItemSnapshot[] | undefined;
  stats?: unknown | undefined;
}

const repoRoot = process.cwd().endsWith(path.join('packages', 'ai-backend'))
  ? path.resolve(process.cwd(), '..', '..')
  : process.cwd();

const DEFAULT_API_BASE_URL = process.env.BENCHMARK_API_BASE_URL ?? 'http://127.0.0.1:3002/api/v1';
const DEFAULT_REPORT_DIR = process.env.BENCHMARK_REPORT_DIR ?? 'benchmark/reports';
const DEFAULT_SCENARIO_PATH = 'benchmark/scenarios/onboarding_growth_initiative/scenario.json';

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesTitle(candidate: string, target: string): boolean {
  const left = normalizeText(candidate);
  const right = normalizeText(target);
  return left.includes(right) || right.includes(left);
}

function parseArgs(argv: string[]) {
  const args = [...argv];
  let scenarioPath = DEFAULT_SCENARIO_PATH;
  let apiBaseUrl = DEFAULT_API_BASE_URL;

  while (args.length > 0) {
    const current = args.shift();
    if (!current) continue;
    if (current === '--') continue;

    if (current === '--base-url') {
      const value = args.shift();
      if (!value) {
        throw new Error('Missing value for --base-url');
      }
      apiBaseUrl = value;
      continue;
    }

    if (!current.startsWith('--')) {
      scenarioPath = current;
      continue;
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  return { scenarioPath, apiBaseUrl };
}

async function api<T>(args: {
  baseUrl: string;
  method: string;
  route: string;
  body?: unknown;
  timeoutMs?: number;
}): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs ?? 420_000);

  try {
    const requestInit: RequestInit = {
      method: args.method,
      headers: {
        'content-type': 'application/json',
      },
      signal: controller.signal,
    };
    if (args.body !== undefined) {
      requestInit.body = JSON.stringify(args.body);
    }

    const response = await fetch(`${args.baseUrl}${args.route}`, requestInit);

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as T) : ({} as T);
    return { status: response.status, payload };
  } finally {
    clearTimeout(timeout);
  }
}

async function loadScenario(scenarioPath: string): Promise<BenchmarkScenario> {
  const raw = await readFile(scenarioPath, 'utf8');
  const parsed = JSON.parse(raw) as BenchmarkScenario;

  if (!parsed.scenarioId || !parsed.displayName || !Array.isArray(parsed.meetings)) {
    throw new Error(`Invalid scenario file: ${scenarioPath}`);
  }

  return parsed;
}

function collectMeetingExpectationResults(args: {
  expectations: MeetingExpectations | undefined;
  executiveSummary: string | undefined;
  detailedSummary: string | undefined;
  items: Array<{ title: string }>;
}): ExpectationResult[] {
  const { expectations, executiveSummary, detailedSummary, items } = args;
  if (!expectations) return [];

  const results: ExpectationResult[] = [];
  const allTitles = items.map((item) => item.title);
  const summaryBody = [executiveSummary ?? '', detailedSummary ?? ''].join('\n');

  for (const target of expectations.mustIncludeItemTitles ?? []) {
    const passed = allTitles.some((candidate) => matchesTitle(candidate, target));
    results.push({
      category: 'meeting_item_presence',
      target,
      passed,
      details: passed
        ? 'Matched at least one meeting item title.'
        : 'No matching meeting item title found.',
    });
  }

  for (const target of expectations.mustNotIncludeItemTitles ?? []) {
    const passed = !allTitles.some((candidate) => matchesTitle(candidate, target));
    results.push({
      category: 'meeting_item_absence',
      target,
      passed,
      details: passed
        ? 'No forbidden meeting item title found.'
        : 'Found a forbidden meeting item title.',
    });
  }

  for (const target of expectations.mustIncludeSummaryPhrases ?? []) {
    const passed = normalizeText(summaryBody).includes(normalizeText(target));
    results.push({
      category: 'meeting_summary_phrase',
      target,
      passed,
      details: passed
        ? 'Phrase found in executive or detailed summary.'
        : 'Phrase missing from meeting summary.',
    });
  }

  return results;
}

function collectFinalProjectChecks(args: {
  expectations: FinalProjectExpectations | undefined;
  items: ProjectItemSnapshot[];
}): ExpectationResult[] {
  const { expectations, items } = args;
  if (!expectations) return [];

  const results: ExpectationResult[] = [];

  for (const expected of expectations.mustHaveItemStatuses ?? []) {
    const matchingItems = items.filter((item) => matchesTitle(item.title, expected.titleLike));
    const passingItem = matchingItems.find((item) => item.status === expected.status);
    const passed = Boolean(passingItem);
    results.push({
      category: 'project_item_status',
      target: `${expected.titleLike} => ${expected.status}`,
      passed,
      details: passingItem
        ? `Found status ${passingItem.status ?? 'null'} for "${passingItem.title}".`
        : matchingItems.length > 0
          ? `Matching items found, but statuses were: ${matchingItems
              .map((item) => `${item.title}=${item.status ?? 'null'}`)
              .join('; ')}.`
          : 'No matching project item found.',
    });
  }

  for (const target of expectations.mustNotHaveOpenTitles ?? []) {
    const violatingItem = items.find((item) => {
      return (
        matchesTitle(item.title, target) &&
        item.status !== 'completed' &&
        item.status !== 'cancelled'
      );
    });
    const passed = !violatingItem;
    results.push({
      category: 'project_open_absence',
      target,
      passed,
      details: violatingItem
        ? `Found open matching item "${violatingItem.title}" with status ${violatingItem.status ?? 'null'}.`
        : 'No open matching item found.',
    });
  }

  return results;
}

function countCheckTotals(
  meetingReports: BenchmarkMeetingReport[],
  finalProjectChecks: ExpectationResult[]
) {
  const allChecks = [
    ...meetingReports.flatMap((meeting) => meeting.expectationResults),
    ...finalProjectChecks,
  ];

  return {
    checksPassed: allChecks.filter((check) => check.passed).length,
    checksFailed: allChecks.filter((check) => !check.passed).length,
  };
}

async function main(): Promise<void> {
  const { scenarioPath, apiBaseUrl } = parseArgs(process.argv.slice(2));
  const resolvedScenarioPath = path.resolve(repoRoot, scenarioPath);
  const scenarioDir = path.dirname(resolvedScenarioPath);
  const scenario = await loadScenario(resolvedScenarioPath);

  const startedAt = new Date();
  const health = await api<unknown>({
    baseUrl: apiBaseUrl,
    method: 'GET',
    route: '/health',
    timeoutMs: 10_000,
  });

  if (health.status !== 200) {
    throw new Error(`Backend health check failed with status ${health.status}`);
  }

  const projectSuffix = process.env.BENCHMARK_PROJECT_SUFFIX
    ? ` ${process.env.BENCHMARK_PROJECT_SUFFIX}`
    : '';
  const projectName = `${scenario.project.name} ${Date.now()}${projectSuffix}`.trim();

  const createProject = await api<{ project?: { id: string; name: string } }>({
    baseUrl: apiBaseUrl,
    method: 'POST',
    route: '/projects',
    body: {
      name: projectName,
      description: scenario.project.description,
      isRecurring: scenario.project.isRecurring ?? true,
    },
  });

  const projectId = createProject.payload.project?.id;
  if (createProject.status !== 201 || !projectId) {
    throw new Error(`Failed to create project: ${JSON.stringify(createProject.payload)}`);
  }

  const meetingReports: BenchmarkMeetingReport[] = [];

  for (const meeting of [...scenario.meetings].sort(
    (left, right) => left.sequenceNumber - right.sequenceNumber
  )) {
    const transcriptPath = path.resolve(scenarioDir, meeting.transcriptPath);
    const transcript = await readFile(transcriptPath, 'utf8');

    const upload = await api<UploadedMeetingResponse>({
      baseUrl: apiBaseUrl,
      method: 'POST',
      route: `/projects/${projectId}/upload-transcript`,
      body: {
        title: meeting.title,
        transcript,
        analysisMode: meeting.analysisMode ?? scenario.defaultAnalysisMode ?? 'product_manager',
        contextNote: meeting.contextNote ?? scenario.defaultContextNote,
      },
    });

    const report: BenchmarkMeetingReport = {
      sequenceNumber: meeting.sequenceNumber,
      slug: meeting.slug,
      title: meeting.title,
      uploadStatus: upload.status,
      transcriptEventCount: upload.payload.transcriptEventsCreated,
      momGeneration: upload.payload.momGeneration,
      itemSnapshot: [],
      expectationResults: [],
    };

    if (upload.status === 201 && upload.payload.meetingId) {
      report.meetingId = upload.payload.meetingId;

      const [mom, items] = await Promise.all([
        api<MeetingMomResponse>({
          baseUrl: apiBaseUrl,
          method: 'GET',
          route: `/meetings/${upload.payload.meetingId}/mom`,
        }),
        api<MeetingItemsResponse>({
          baseUrl: apiBaseUrl,
          method: 'GET',
          route: `/meetings/${upload.payload.meetingId}/items`,
        }),
      ]);

      report.executiveSummary = mom.payload.mom?.executiveSummary ?? undefined;
      report.detailedSummary = mom.payload.mom?.detailedSummary ?? undefined;
      report.itemSnapshot = (items.payload.items ?? []).map((item) => ({
        itemType: item.itemType,
        title: item.title,
        status: item.status,
        assignee: item.assignee,
        priority: item.priority,
      }));
      report.expectationResults = collectMeetingExpectationResults({
        expectations: meeting.expectations,
        executiveSummary: report.executiveSummary,
        detailedSummary: report.detailedSummary,
        items: report.itemSnapshot,
      });
    } else {
      report.expectationResults.push({
        category: 'meeting_summary_phrase',
        target: 'upload_success',
        passed: false,
        details: `Transcript upload failed with status ${upload.status}.`,
      });
    }

    meetingReports.push(report);
  }

  const finalProject = await api<ProjectStateResponse>({
    baseUrl: apiBaseUrl,
    method: 'GET',
    route: `/projects/${projectId}`,
  });

  const finalProjectItems = finalProject.payload.items ?? [];
  const finalProjectChecks = collectFinalProjectChecks({
    expectations: scenario.finalProjectExpectations,
    items: finalProjectItems,
  });

  const totals = countCheckTotals(meetingReports, finalProjectChecks);
  const reportDir = path.resolve(repoRoot, DEFAULT_REPORT_DIR);
  await mkdir(reportDir, { recursive: true });

  const reportFileName = `${startedAt.toISOString().replace(/[:.]/g, '-')}-${scenario.scenarioId}.json`;
  const reportPath = path.join(reportDir, reportFileName);

  const report: BenchmarkReport = {
    scenario: {
      scenarioId: scenario.scenarioId,
      displayName: scenario.displayName,
      schemaVersion: scenario.schemaVersion,
      sourcePath: resolvedScenarioPath,
    },
    run: {
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      apiBaseUrl,
      reportPath,
      projectId,
      projectName,
      health: health.payload,
    },
    summary: {
      meetingsProcessed: meetingReports.length,
      checksPassed: totals.checksPassed,
      checksFailed: totals.checksFailed,
    },
    meetings: meetingReports,
    finalProjectChecks,
    finalProjectSnapshot: {
      project: finalProject.payload.project,
      meetings: finalProject.payload.meetings,
      items: finalProjectItems,
      stats: finalProject.payload.stats,
    },
  };

  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(
    JSON.stringify(
      {
        scenarioId: scenario.scenarioId,
        projectId,
        projectName,
        meetingsProcessed: report.summary.meetingsProcessed,
        checksPassed: report.summary.checksPassed,
        checksFailed: report.summary.checksFailed,
        reportPath,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
