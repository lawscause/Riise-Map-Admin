import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Printer,
  Mail,
  Copy,
  Check,
  CheckCircle2,
  Circle,
  Loader2,
  FileText,
  AlertCircle,
  ChevronDown,
  HelpCircle,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

import { useImpactReportData } from './useImpactReportData';
import { CollapsibleSection } from './CollapsibleSection';
import { PrintHeader } from './PrintHeader';

import type {
  FundingSourceReportData,
  GoalData,
  HealthStatus,
  PathwayReportData,
  PortfolioSummaryData,
  ProgramAggregateData,
  ProgramReportData,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_KEY = 'impact-report-selected-source';

const HEALTH_CONFIG: Record<
  HealthStatus,
  { label: string; className: string }
> = {
  on_track: { label: 'On Track', className: 'text-emerald-600 bg-emerald-50' },
  at_risk: { label: 'At Risk', className: 'text-amber-600 bg-amber-50' },
  off_track: { label: 'Off Track', className: 'text-red-600 bg-red-50' },
  not_started: { label: 'Not Started', className: 'text-gray-600 bg-gray-50' },
  no_targets: {
    label: 'No Targets Defined',
    className: 'text-gray-600 bg-gray-50',
  },
  expiring_soon: {
    label: 'Expiring Soon',
    className: 'text-orange-600 bg-orange-50',
  },
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ImpactReport() {
  const { isLoading, isError, data } = useImpactReportData();

  // Session-persisted source selector
  const [selectedSource, setSelectedSource] = useState<string>(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) || 'all';
    } catch {
      return 'all';
    }
  });

  // Email modal state — no longer needed, using mailto approach

  const [filterStatus, setFilterStatus] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('status') || 'all';
  });
  const [selectorOpen, setSelectorOpen] = useState(false);

  // Validate persisted selection still exists
  useEffect(() => {
    if (!data) return;
    if (selectedSource === 'all') return;
    const exists = data.fundingSources.some(
      (fs) => String(fs.id) === selectedSource,
    );
    if (!exists) {
      setSelectedSource('all');
      try {
        sessionStorage.setItem(SESSION_KEY, 'all');
      } catch {
        // Ignore storage errors
      }
    }
  }, [data, selectedSource]);

  const handleSourceChange = (value: string) => {
    setSelectedSource(value);
    try {
      sessionStorage.setItem(SESSION_KEY, value);
    } catch {
      // Ignore storage errors
    }
  };

  const handleOpenEmail = () => {
    const sourceName = selectedFundingSource ? selectedFundingSource.name : 'All Funding Sources';
    const subject = `Funding Impact Report — ${sourceName}`;
    const body = 'Please find the attached Funding Impact Report.\n\n(Use Print > Save as PDF to generate the report, then attach it to this email.)';
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // Error state
  if (isError) {
    return <ErrorState />;
  }

  // Empty state
  if (!data || data.fundingSources.length === 0) {
    return <EmptyState />;
  }

  const selectedFundingSource =
    selectedSource !== 'all'
      ? data.fundingSources.find((fs) => String(fs.id) === selectedSource)
      : null;

  return (
    <div className="space-y-6">
      {/* Print header - hidden on screen */}
      <PrintHeader
        fundingSourceName={
          selectedFundingSource ? selectedFundingSource.name : undefined
        }
      />

      {/* Controls bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
        <div className="space-y-3">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Funding Source</label>
          <Popover open={selectorOpen} onOpenChange={setSelectorOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-[320px] h-11 justify-between font-normal text-sm shadow-sm">
                <span className="truncate">{selectedSource === 'all' ? 'All Funding Sources' : data.fundingSources.find(fs => String(fs.id) === selectedSource)?.name || 'Select...'}</span>
                <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search funding sources..." />
                <CommandList>
                  <CommandEmpty>No results found.</CommandEmpty>
                  <CommandItem value="all" onSelect={() => { handleSourceChange('all'); setSelectorOpen(false); }}>
                    All Funding Sources
                  </CommandItem>
                  {(['on_track', 'at_risk', 'off_track', 'expiring_soon', 'not_started', 'no_targets'] as const)
                    .map(status => {
                      const sources = [...data.fundingSources].filter(fs => fs.healthStatus === status).sort((a, b) => a.name.localeCompare(b.name));
                      if (sources.length === 0) return null;
                      return (
                        <CommandGroup key={status} heading={HEALTH_CONFIG[status].label}>
                          {sources.map(fs => (
                            <CommandItem key={fs.id} value={fs.name} onSelect={() => { handleSourceChange(String(fs.id)); setSelectorOpen(false); }}>
                              {fs.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      );
                    })}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleOpenEmail}
            className="min-h-[44px] min-w-[44px]"
          >
            <Mail className="h-4 w-4 mr-2" />
            Email Report
          </Button>
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="min-h-[44px] min-w-[44px]"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Portfolio summary (when "All" selected) */}
      {/* Portfolio summary (when "All" selected) */}
      <div id="impact-report-content">
      {selectedSource === 'all' && (
        <>
          <PortfolioSummary data={data.portfolio} />

          <Card className="mt-6">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <label className="text-sm font-medium text-foreground">Status</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground"><HelpCircle className="h-3.5 w-3.5" /></button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 text-sm space-y-2" align="start">
                      <p className="font-semibold text-foreground mb-2">Status Definitions</p>
                      <div className="space-y-2 text-muted-foreground">
                        <p><span className="font-medium text-emerald-600">On Track</span> — Enrollment is keeping pace with the grant timeline. You're meeting or ahead of your targets.</p>
                        <p><span className="font-medium text-amber-600">At Risk</span> — Enrollment is falling slightly behind schedule. Consider reviewing recruitment or outreach.</p>
                        <p><span className="font-medium text-red-600">Off Track</span> — Enrollment is significantly behind where it should be given the time elapsed.</p>
                        <p><span className="font-medium text-orange-600">Expiring Soon</span> — This grant period ends within 30 days.</p>
                        <p><span className="font-medium text-gray-600">Not Started</span> — This funding source hasn't reached its start date yet.</p>
                        <p><span className="font-medium text-gray-500">No Targets</span> — No learner targets or goals have been set for this funding source.</p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[180px] min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="on_track">On Track</SelectItem>
                    <SelectItem value="at_risk">At Risk</SelectItem>
                    <SelectItem value="off_track">Off Track</SelectItem>
                    <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="no_targets">No Targets</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.fundingSources.filter(fs => filterStatus === 'all' || fs.healthStatus === filterStatus).map((fs) => {
              const healthCfg = HEALTH_CONFIG[fs.healthStatus];
              return (
                <Card
                  key={fs.id}
                  className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                  onClick={() => handleSourceChange(String(fs.id))}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold leading-tight">{fs.name}</h3>
                      <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap', healthCfg.className)}>
                        {healthCfg.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <p className="font-medium text-foreground">
                          {fs.amount != null ? `$${fs.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : 'N/A'}
                        </p>
                        <p>Amount</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {fs.goalCompletion.completed}/{fs.goalCompletion.total}
                        </p>
                        <p>Goals</p>
                      </div>
                    </div>
                    {fs.goalCompletion.total > 0 && (
                      <Progress value={fs.goalCompletion.rate} className="h-1.5" />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Individual funding source detail */}
      {selectedFundingSource && (
        <div>
          <Button
            variant="outline"
            size="sm"
            className="mb-4 print:hidden"
            onClick={() => handleSourceChange('all')}
          >
            ← Back to All Funding Sources
          </Button>
          <FundingSourceSection data={selectedFundingSource} />
        </div>
      )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading State
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-[280px]" />
        <Skeleton className="h-10 w-[130px]" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error State
// ---------------------------------------------------------------------------

function ErrorState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">Unable to load report</h3>
        <p className="text-muted-foreground">
          An error occurred while loading the impact report data. Please try
          refreshing the page.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          No funding sources are associated with this account.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Portfolio Summary
// ---------------------------------------------------------------------------

function PortfolioSummary({ data }: { data: PortfolioSummaryData }) {
  const kpis = [
    {
      label: 'Total Funding',
      value: `$${data.totalFundingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      label: 'Learner Target',
      value: data.totalLearnerTarget > 0 ? String(data.totalLearnerTarget) : 'N/A',
    },
    {
      label: 'Funded Learners',
      value: String(data.totalEnrolledLearners),
    },
    {
      label: 'Unfunded Learners',
      value: String(data.totalLearnersInSystem - data.totalEnrolledLearners),
      badgeClass: (data.totalLearnersInSystem - data.totalEnrolledLearners) > 0 ? 'text-amber-600 bg-amber-50' : '',
    },
    {
      label: 'Progress Rate',
      value: data.overallProgressRate != null ? `${data.overallProgressRate}%` : 'N/A',
    },
    {
      label: 'On Track',
      value: String(data.healthStatusCounts.onTrack),
      badgeClass: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'At Risk',
      value: String(data.healthStatusCounts.atRisk),
      badgeClass: 'text-amber-600 bg-amber-50',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Portfolio Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="shadow-none border">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
                <p
                  className={cn(
                    'text-2xl font-bold mt-1',
                    kpi.badgeClass,
                  )}
                >
                  {kpi.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Funding Source Section
// ---------------------------------------------------------------------------

function FundingSourceSection({ data }: { data: FundingSourceReportData }) {
  return (
    <div className="space-y-4 print:break-before-page">
      <ReportHeader data={data} />

      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-base">Health Status</CardTitle>
        </CardHeader>
        <CardContent><HealthIndicator data={data} /></CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-base">Key Metrics</CardTitle>
        </CardHeader>
        <CardContent><KPICards data={data} /></CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-base">Funding Goals</CardTitle>
        </CardHeader>
        <CardContent><GoalProgress goals={data.goals} goalCompletion={data.goalCompletion} fundingSourceId={data.id} /></CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-base">Program Activity</CardTitle>
        </CardHeader>
        <CardContent><ProgramActivity programs={data.programs} aggregates={data.programAggregates} /></CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-base">Pathway Participation</CardTitle>
        </CardHeader>
        <CardContent><PathwayParticipation pathways={data.pathways} /></CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-base">Impact Narrative</CardTitle>
        </CardHeader>
        <CardContent><TemplateNarrative narrative={data.templateNarrative} /></CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report Header
// ---------------------------------------------------------------------------

function ReportHeader({ data }: { data: FundingSourceReportData }) {
  const formattedAmount =
    data.amount != null
      ? `$${data.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : 'N/A';

  const formattedStart = data.startDate
    ? format(parseISO(data.startDate), 'MMM d, yyyy')
    : null;
  const formattedEnd = data.endDate
    ? format(parseISO(data.endDate), 'MMM d, yyyy')
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{data.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key fields grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Amount</p>
            <p className="font-medium">{formattedAmount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Learner Target</p>
            <p className="font-medium">
              {data.learnerCount != null ? data.learnerCount : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Start Date</p>
            <p className="font-medium">{formattedStart ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">End Date</p>
            <p className="font-medium">{formattedEnd ?? 'N/A'}</p>
          </div>
        </div>

        {/* Timeline progress bar */}
        <TimelineBar data={data} />

        {/* Objectives */}
        {data.objectives && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Objectives
            </p>
            <p className="text-sm">{data.objectives}</p>
          </div>
        )}

        {/* Narrative */}
        {data.narrative && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Narrative
            </p>
            <p className="text-sm">{data.narrative}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Timeline Bar
// ---------------------------------------------------------------------------

function TimelineBar({ data }: { data: FundingSourceReportData }) {
  // No dates set
  if (data.startDate == null || data.endDate == null) {
    return (
      <p className="text-sm text-muted-foreground italic">Dates not set</p>
    );
  }

  // Expired
  if (data.isExpired) {
    return (
      <div className="flex items-center gap-2">
        <Progress value={100} className="flex-1" />
        <Badge variant="destructive">Expired</Badge>
      </div>
    );
  }

  // Not started
  if (data.isNotStarted) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Timeline</span>
          <span className="text-muted-foreground">Not Started</span>
        </div>
        <Progress value={0} />
      </div>
    );
  }

  // Active - show progress
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Timeline</span>
        <span className="text-muted-foreground">{data.timeProgress}%</span>
      </div>
      <Progress value={data.timeProgress ?? 0} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Health Indicator
// ---------------------------------------------------------------------------

function HealthIndicator({ data }: { data: FundingSourceReportData }) {
  const config = HEALTH_CONFIG[data.healthStatus];

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div
        className={cn(
          'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold',
          config.className,
        )}
      >
        <HealthDot status={data.healthStatus} />
        {config.label}
      </div>

      {/* Enrollment Pace */}
      {data.learnerCount != null && (
        <div className="space-y-1 text-sm">
          <p className="font-medium">Enrollment Pace</p>
          <p>
            Enrolled: {data.enrolledLearners} learners
          </p>
          <p>
            Target: {data.learnerCount} learners
          </p>
          {data.progressRate != null && (
            <p>Rate: {data.progressRate}%</p>
          )}
          {data.timeProgress != null && (
            <p>Timeline: {data.timeProgress}% elapsed</p>
          )}
          {data.paceGap != null && (
            <p>
              Pace:{' '}
              {data.paceGap >= 0
                ? `+${data.paceGap} points ahead`
                : `${data.paceGap} points behind`}
            </p>
          )}
        </div>
      )}

      {/* Goal completion */}
      <p className="text-sm">
        {data.goalCompletion.completed} of {data.goalCompletion.total} goals
        completed
      </p>
    </div>
  );
}

function HealthDot({ status }: { status: HealthStatus }) {
  const colorMap: Record<HealthStatus, string> = {
    on_track: 'bg-emerald-500',
    at_risk: 'bg-amber-500',
    off_track: 'bg-red-500',
    not_started: 'bg-gray-400',
    no_targets: 'bg-gray-400',
    expiring_soon: 'bg-orange-500',
  };
  return <span className={cn('h-3 w-3 rounded-full', colorMap[status])} />;
}

// ---------------------------------------------------------------------------
// KPI Cards
// ---------------------------------------------------------------------------

function KPICards({ data }: { data: FundingSourceReportData }) {
  const avgCompletionRate =
    data.programs.length > 0
      ? Math.round(
          data.programs.reduce((sum, p) => sum + p.completionRate, 0) /
            data.programs.length,
        )
      : null;

  const avgReadinessScore =
    data.programs.length > 0
      ? Math.round(
          data.programs.reduce((sum, p) => sum + p.readinessScore, 0) /
            data.programs.length,
        )
      : null;

  const totalPlacementReady =
    data.programs.length > 0
      ? data.programs.reduce((sum, p) => sum + p.placementReady, 0)
      : null;

  const kpis = [
    {
      label: 'Funded Learners',
      value: String(data.enrolledLearners),
    },
    {
      label: 'Progress Rate',
      value: data.progressRate != null ? `${data.progressRate}%` : 'N/A',
    },
    {
      label: 'Goal Completion',
      value:
        data.goalCompletion.rate != null ? `${data.goalCompletion.rate}%` : 'N/A',
    },
    {
      label: 'Avg Completion Rate',
      value: avgCompletionRate != null ? `${avgCompletionRate}%` : 'N/A',
    },
    {
      label: 'Avg Readiness Score',
      value: avgReadinessScore != null ? `${avgReadinessScore}%` : 'N/A',
    },
    {
      label: 'Placement Ready',
      value: totalPlacementReady != null ? String(totalPlacementReady) : 'N/A',
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="shadow-none border">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{kpi.label}</p>
            <p className="text-2xl font-bold mt-1">{kpi.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goal Progress
// ---------------------------------------------------------------------------

function GoalProgress({
  goals,
  goalCompletion,
  fundingSourceId,
}: {
  goals: GoalData[];
  goalCompletion: { completed: number; total: number; rate: number | null };
  fundingSourceId: number;
}) {
  if (goals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No goals defined for this funding source.
      </p>
    );
  }

  const progressValue =
    goalCompletion.total > 0
      ? Math.round((goalCompletion.completed / goalCompletion.total) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {goalCompletion.completed} of {goalCompletion.total} goals completed
        </p>
        <Progress value={progressValue} />
      </div>

      {/* Goal list */}
      <ul className="space-y-3">
        {goals.map((goal) => (
          <li key={goal.id} className="flex items-start gap-3">
            <GoalStatusIcon status={goal.status} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{goal.title}</p>
              {goal.note && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  &ldquo;{goal.note}&rdquo;
                </p>
              )}
              {goal.documentFileName && (
                <a
                  href={`${import.meta.env.VITE_API_URL || ''}/api/funding-sources/${fundingSourceId}/goals/${goal.id}/document`}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1 min-h-[44px] lg:min-h-0"
                  download
                >
                  <FileText className="h-4 w-4" />
                  {goal.documentFileName}
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GoalStatusIcon({ status }: { status: GoalData['status'] }) {
  switch (status) {
    case 'completed':
      return (
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
      );
    case 'in_progress':
      return (
        <Loader2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5 animate-spin" />
      );
    case 'not_started':
      return (
        <Circle className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
      );
  }
}

// ---------------------------------------------------------------------------
// Program Activity
// ---------------------------------------------------------------------------

function ProgramActivity({
  programs,
  aggregates,
}: {
  programs: ProgramReportData[];
  aggregates: ProgramAggregateData | null;
}) {
  if (programs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No programs associated with this funding source.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Aggregate row */}
      {aggregates && (
        <div className="flex flex-wrap gap-4 text-sm p-3 bg-muted/50 rounded-md">
          <span>
            <span className="text-muted-foreground">Total Learners:</span>{' '}
            <span className="font-medium">{aggregates.totalActiveLearners}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Avg Completion:</span>{' '}
            <span className="font-medium">
              {aggregates.weightedCompletionRate}%
            </span>
          </span>
          <span>
            <span className="text-muted-foreground">Events:</span>{' '}
            <span className="font-medium">
              {aggregates.totalEventParticipation}
            </span>
          </span>
          <span>
            <span className="text-muted-foreground">Placement Ready:</span>{' '}
            <span className="font-medium">
              {aggregates.totalPlacementReady}
            </span>
          </span>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Program</TableHead>
              <TableHead className="text-right">Learners</TableHead>
              <TableHead className="text-right">Completion</TableHead>
              <TableHead className="text-right">Readiness</TableHead>
              <TableHead className="text-right">Events</TableHead>
              <TableHead className="text-right">Placement Ready</TableHead>
              <TableHead>Dates</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {programs.map((program) => (
              <TableRow key={program.id}>
                <TableCell className="font-medium">{program.name}</TableCell>
                <TableCell className="text-right">
                  {program.activeLearners}
                </TableCell>
                <TableCell className="text-right">
                  {program.completionRate}%
                </TableCell>
                <TableCell className="text-right">
                  {program.readinessScore}
                </TableCell>
                <TableCell className="text-right">
                  {program.eventParticipation}
                </TableCell>
                <TableCell className="text-right">
                  {program.placementReady}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(parseISO(program.startDate), 'MMM d, yyyy')} –{' '}
                  {format(parseISO(program.endDate), 'MMM d, yyyy')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {programs.map((program) => (
          <Card key={program.id} className="shadow-none border">
            <CardContent className="p-4 space-y-2">
              <p className="font-medium">{program.name}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Learners: </span>
                  {program.activeLearners}
                </div>
                <div>
                  <span className="text-muted-foreground">Completion: </span>
                  {program.completionRate}%
                </div>
                <div>
                  <span className="text-muted-foreground">Readiness: </span>
                  {program.readinessScore}
                </div>
                <div>
                  <span className="text-muted-foreground">Events: </span>
                  {program.eventParticipation}
                </div>
                <div>
                  <span className="text-muted-foreground">Placement: </span>
                  {program.placementReady}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(parseISO(program.startDate), 'MMM d, yyyy')} –{' '}
                {format(parseISO(program.endDate), 'MMM d, yyyy')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pathway Participation
// ---------------------------------------------------------------------------

function PathwayParticipation({
  pathways,
}: {
  pathways: PathwayReportData[];
}) {
  if (pathways.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No pathways associated with this funding source.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {pathways.map((pathway) => (
        <Card key={pathway.id} className="shadow-none border">
          <CardContent className="p-4 space-y-2">
            <p className="font-medium">{pathway.name}</p>
            <p className="text-sm text-muted-foreground">
              {pathway.estimatedWeeks} weeks • {pathway.activeLearners} active
              learners
              {pathway.milestoneCount > 0 &&
                ` • ${pathway.milestoneCount} milestones`}
            </p>
            {pathway.skills.length > 0 && (
              <p className="text-sm">
                <span className="text-muted-foreground">Skills: </span>
                {pathway.skills.join(', ')}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template Narrative
// ---------------------------------------------------------------------------

function TemplateNarrative({ narrative }: { narrative: string | null }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!narrative) return;
    try {
      await navigator.clipboard.writeText(narrative);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = narrative;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }, [narrative]);

  if (!narrative) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Insufficient data to generate narrative.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed">{narrative}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="min-h-[44px] lg:min-h-0 print:hidden"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 mr-2 text-emerald-600" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4 mr-2" />
            Copy Narrative
          </>
        )}
      </Button>
    </div>
  );
}
