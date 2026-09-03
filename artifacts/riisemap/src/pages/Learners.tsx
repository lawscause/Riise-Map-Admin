import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  Search, LayoutGrid, List, ChevronRight, X,
  Check, Mail, UserPlus, Trash2, Loader2, Upload, Download, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useGetLearners, useCreateLearner, useGetPathways, useGetPrograms, type Learner } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/lib/UserContext";
import Papa from "papaparse";

interface InviteForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  pathway: string;
  program: string;
  coach: string;
  message: string;
}

const PROGRAM_LABELS: Record<string, string> = {
  "aws-cwi-2024": "AWS CWI Program 2024",
  "google-data-2024": "Google Data Analytics 2024",
  "meta-social-2024": "Meta Social Media Marketing 2024",
};

const BLANK_INVITE: InviteForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  pathway: "",
  program: "",
  coach: "",
  message: "",
};

export default function Learners() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { data: allLearners = [], isLoading } = useGetLearners();
  const createLearnerMutation = useCreateLearner({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/learners'] });
        toast({
          title: "Success!",
          description: "New learner has been invited.",
        });
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Uh oh! Something went wrong.",
          description: "There was a problem with your request. Please try again.",
        });
      }
    }
  });
  const [newLearnerId, setNewLearnerId] = useState<number | null>(null);
  const { data: allPathways = [] } = useGetPathways();
  const { data: allPrograms = [] } = useGetPrograms();
  const [pathwayProgramLinks, setPathwayProgramLinks] = useState<{ pathwayId: number; programId: number }[]>([]);

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || "";
    authFetch(`${baseUrl}/api/pathway-programs`).then(r => r.json()).then(setPathwayProgramLinks).catch(() => {});
  }, []);

  const [view, setView] = useState<"grid" | "list">("list");
  const [search, setSearch] = useState("");
  const searchString = useSearch();
  const statusParam = new URLSearchParams(searchString).get("status");
  const [filterStatus, setFilterStatus] = useState<string[]>(
    statusParam ? statusParam.split(",") : []
  );
  const [filterCoach, setFilterCoach] = useState("all");
  const [filterPathway, setFilterPathway] = useState("all");

  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || "";
    authFetch(`${baseUrl}/api/learner-statuses`).then(r => r.json()).then((data: any[]) => setStatusOptions(data.map(s => s.name))).catch(() => {});
  }, []);

  type SortKey = "name" | "pathway" | "coach" | "progress" | "readiness" | "status" | "createdAt";
  type SortDir = "asc" | "desc";
  const sortParam = new URLSearchParams(searchString).get("sort") as SortKey | null;
  const dirParam = new URLSearchParams(searchString).get("dir") as SortDir | null;
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    if (sortParam) return sortParam;
    try { return (sessionStorage.getItem("learners_sortKey") as SortKey) || "createdAt"; } catch { return "createdAt"; }
  });
  const [sortDir, setSortDir] = useState<SortDir>(() => {
    if (dirParam) return dirParam;
    try { return (sessionStorage.getItem("learners_sortDir") as SortDir) || "desc"; } catch { return "desc"; }
  });
  const handleSort = (key: SortKey) => {
    const newDir = sortKey === key && sortDir === "asc" ? "desc" : "asc";
    setSortKey(key);
    setSortDir(newDir);
    try { sessionStorage.setItem("learners_sortKey", key); sessionStorage.setItem("learners_sortDir", newDir); } catch {}
  };

  const [showInvite, setShowInvite] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const defaultMessage = `Hi,\n\nYou've been invited to join ${user.orgName || "our"} workforce development program.\n\nThrough RiiseMap, you'll have access to career pathways, coaching, projects, and events designed to help you succeed.\n\nClick the link below to get started.\n\nLooking forward to supporting your journey,\n${user.fullName}\n${user.orgName}`;
  const [inviteStep, setInviteStep] = useState<0 | 1>(0);
  const [inviteForm, setInviteForm] = useState<InviteForm>({ ...BLANK_INVITE, message: defaultMessage });
  const [inviteErrors, setInviteErrors] = useState<Partial<Record<keyof InviteForm, string>>>({});

  const filtered = allLearners.filter((l) => {
    const matchSearch =
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.pathway.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus.length === 0 || filterStatus.includes(l.status);
    const matchCoach = filterCoach === "all" || l.coach === filterCoach;
    const matchPathway = filterPathway === "all" || l.pathway === filterPathway;
    return matchSearch && matchStatus && matchCoach && matchPathway;
  }).sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });

  const coaches = [...new Set(allLearners.map((l) => l.coach))].filter(Boolean);
  const pathwayOptions = [...new Set(allLearners.map((l) => l.pathway))].filter(Boolean);

  const setField = (field: keyof InviteForm, value: string) => {
    setInviteForm((f) => ({ ...f, [field]: value }));
    setInviteErrors((e) => ({ ...e, [field]: "" }));
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits.length ? `(${digits}` : "";
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const setPhoneField = (value: string) => {
    setInviteForm((f) => ({ ...f, phone: formatPhone(value) }));
    setInviteErrors((e) => ({ ...e, phone: "" }));
  };

  const validateField = (field: keyof InviteForm) => {
    const value = inviteForm[field];
    let error = "";
    switch (field) {
      case "firstName":
        if (!value.trim()) error = "First name is required";
        else if (value.trim().length > 50) error = "First name must be 50 characters or less";
        break;
      case "lastName":
        if (!value.trim()) error = "Last name is required";
        else if (value.trim().length > 50) error = "Last name must be 50 characters or less";
        break;
      case "email":
        if (!value.trim()) error = "Email address is required";
        else if (value.trim().length > 100) error = "Email must be 100 characters or less";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) error = "Please enter a valid email address";
        break;
      case "phone":
        if (value.trim()) {
          const digits = value.replace(/\D/g, "");
          if (digits.length !== 10) error = "Enter a valid 10-digit phone number";
        }
        break;
      case "message":
        if (value.length > 500) error = "Message must be 500 characters or less";
        break;
    }
    setInviteErrors((e) => ({ ...e, [field]: error }));
  };

  const validateInvite = () => {
    const e: typeof inviteErrors = {};
    if (!inviteForm.firstName.trim()) e.firstName = "First name is required";
    else if (inviteForm.firstName.trim().length > 50) e.firstName = "First name must be 50 characters or less";
    if (!inviteForm.lastName.trim()) e.lastName = "Last name is required";
    else if (inviteForm.lastName.trim().length > 50) e.lastName = "Last name must be 50 characters or less";
    if (!inviteForm.email.trim()) e.email = "Email address is required";
    else if (inviteForm.email.trim().length > 100) e.email = "Email must be 100 characters or less";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteForm.email.trim()))
      e.email = "Please enter a valid email address";
    if (inviteForm.phone.trim()) {
      const digits = inviteForm.phone.replace(/\D/g, "");
      if (digits.length !== 10 && digits.length !== 11)
        e.phone = "Enter a valid phone number, e.g. (404) 555-0100";
    }
    if (inviteForm.message.length > 500) e.message = "Message must be 500 characters or less";
    setInviteErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSendInvite = async () => {
    if (!validateInvite()) return;

    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    try {
      const newLearner = await createLearnerMutation.mutateAsync({
        data: {
          name: `${inviteForm.firstName.trim()} ${inviteForm.lastName.trim()}`,
          pathway: inviteForm.pathway || "Not yet assigned",
          program: inviteForm.program || "Not yet enrolled",
          coach: inviteForm.coach || "Unassigned",
          progress: 0,
          readiness: 0,
          status: "New Learner",
          lastActive: "Just invited",
          nextAction: "Complete onboarding and career assessment",
          joinDate: today,
          email: inviteForm.email.trim(),
        }
      });
      setNewLearnerId(newLearner.id);
      await navigator.clipboard.writeText(inviteForm.message);
      setInviteStep(1);
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast({
          title: "Duplicate Learner",
          description: "A learner with this email already exists.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error Creating Learner",
          description: "An unexpected error occurred. Please try again later.",
          variant: "destructive",
        });
      }
      console.error("Failed to create learner:", error);
    }
  };

  const closeInvite = () => {
    setShowInvite(false);
    setTimeout(() => {
      setInviteStep(0);
      setInviteForm(BLANK_INVITE);
      setInviteErrors({});
    }, 300);
  };

  return (
    <div className="p-5 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Learners</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? "Loading..." : `${allLearners.length} learners enrolled across ${allPrograms.length} programs`}
          </p>
          {allLearners.length > 0 && <p className="text-xs text-muted-foreground/70 mt-0.5">Select items with checkboxes to delete multiple at once</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
            <Upload size={13} className="mr-1.5" /> Import CSV
          </Button>
          <Button
            size="sm"
            data-testid="invite-learners-btn"
            onClick={() => { setInviteStep(0); setShowInvite(true); }}
          >
            <UserPlus size={13} className="mr-1.5" /> Invite Learners
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-20 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 mb-4 shadow-sm">
          <span className="text-sm text-amber-800 font-medium">{selectedIds.size} learner{selectedIds.size > 1 ? "s" : ""} selected</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setSelectedIds(new Set())}>Clear</Button>
            <Button variant="destructive" size="sm" className="text-xs h-7" onClick={() => setShowBulkDelete(true)}>
              <Trash2 size={12} className="mr-1" /> Delete Selected
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search learners..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            data-testid="search-learners"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-44 h-9 text-sm justify-between" data-testid="filter-status">
              {filterStatus.length === 0 ? "All Statuses" : `${filterStatus.length} selected`}
              <ChevronRight size={12} className="rotate-90 ml-1 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" align="start">
            {statusOptions.map((status) => (
              <label key={status} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                <Checkbox
                  checked={filterStatus.includes(status)}
                  onCheckedChange={(checked) => {
                    setFilterStatus(prev =>
                      checked ? [...prev, status] : prev.filter(s => s !== status)
                    );
                  }}
                />
                {status}
              </label>
            ))}
            {filterStatus.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full mt-1 text-xs h-7" onClick={() => setFilterStatus([])}>
                Clear all
              </Button>
            )}
          </PopoverContent>
        </Popover>
        <Select value={filterCoach} onValueChange={setFilterCoach}>
          <SelectTrigger className="w-40 h-9 text-sm" data-testid="filter-coach">
            <SelectValue placeholder="Coach" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Coaches</SelectItem>
            {coaches.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPathway} onValueChange={setFilterPathway}>
          <SelectTrigger className="w-52 h-9 text-sm" data-testid="filter-pathway">
            <SelectValue placeholder="Pathway" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pathways</SelectItem>
            {pathwayOptions.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 border rounded-lg p-0.5">
          <button
            onClick={() => setView("list")}
            data-testid="view-list"
            className={cn("p-1.5 rounded", view === "list" ? "bg-muted" : "hover:bg-muted/50")}
          >
            <List size={15} />
          </button>
          <button
            onClick={() => setView("grid")}
            data-testid="view-grid"
            className={cn("p-1.5 rounded", view === "grid" ? "bg-muted" : "hover:bg-muted/50")}
          >
            <LayoutGrid size={15} />
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Showing {filtered.length} of {allLearners.length} learners
      </p>

      {allLearners.length === 0 ? (
        <Card className="border-card-border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <UserPlus size={24} className="text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No Learners Yet</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-sm">
              Invite your first learner to get started. They'll receive an email with instructions to join your program.
            </p>
            <Button size="sm" onClick={() => { setInviteStep(0); setShowInvite(true); }}>
              <UserPlus size={13} className="mr-1.5" /> Invite Your First Learner
            </Button>
          </CardContent>
        </Card>
      ) : view === "list" ? (
        <Card className="border-card-border shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-3 w-8" />
                    {([["name","Learner"],["pathway","Pathway"],["coach","Coach"],["progress","Progress"],["readiness","Readiness"],["status","Status"],["createdAt","Created"]] as [SortKey, string][]).map(([key, label]) => (
                      <th key={key} className={`text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors${key === "progress" ? " w-40" : ""}`} onClick={() => handleSort(key)}>
                        {label}{sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                      </th>
                    ))}
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((learner, i) => {
                    const isNew = learner.id === newLearnerId;
                    return (
                      <tr
                        key={learner.id}
                        data-testid={`learner-row-${learner.id}`}
                        className={cn(
                          "hover:bg-muted/20 transition-colors",
                          i !== filtered.length - 1 && "border-b",
                          isNew && "bg-primary/5 ring-inset ring-1 ring-primary/20"
                        )}
                      >
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedIds.has(learner.id)}
                            onCheckedChange={(checked) => {
                              setSelectedIds(prev => {
                                const next = new Set(prev);
                                if (checked) next.add(learner.id); else next.delete(learner.id);
                                return next;
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              <span className="text-xs font-semibold text-primary">{learner.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}</span>
                            </div>
                            <div>
                              <div className="font-medium text-foreground flex items-center gap-1.5">
                                {learner.name}
                                {isNew && (
                                  <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-semibold">New</span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">{learner.program}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate">{learner.pathway}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{learner.coach}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Progress value={learner.progress} className="h-1.5 w-20" />
                            <span className="text-xs text-muted-foreground">{learner.progress}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                            learner.readiness >= 80 ? "bg-emerald-100 text-emerald-700" :
                            learner.readiness >= 60 ? "bg-blue-100 text-blue-700" :
                            "bg-amber-100 text-amber-700"
                          )}>
                            {learner.readiness}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={learner.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{learner.createdAt ? new Date(learner.createdAt).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3">
                          <Link href={`/learners/${learner.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" data-testid={`view-learner-${learner.id}`}>
                              View <ChevronRight size={12} className="ml-1" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((learner) => {
            const isNew = learner.id === newLearnerId;
            return (
              <Link key={learner.id} href={`/learners/${learner.id}`}>
                <Card
                  data-testid={`learner-card-${learner.id}`}
                  className={cn(
                    "border-card-border shadow-sm hover:shadow-md transition-shadow cursor-pointer",
                    isNew && "ring-2 ring-primary/30"
                  )}
                >
                  <CardContent className="p-5">
                    {isNew && (
                      <div className="flex items-center gap-1 text-xs text-primary font-medium mb-2">
                        <Check size={11} /> Newly added
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                          {learner.photo
                            ? <img src={learner.photo} alt={learner.name} className="w-full h-full object-cover" />
                            : <span className="text-sm font-semibold text-primary">{learner.name.split(" ").map((n) => n[0]).join("")}</span>
                          }
                        </div>
                        <div>
                          <div className="font-semibold text-foreground text-sm">{learner.name}</div>
                          <div className="text-xs text-muted-foreground">{learner.coach}</div>
                        </div>
                      </div>
                      <StatusBadge status={learner.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 truncate">{learner.pathway}</p>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Roadmap progress</span>
                          <span className="font-medium">{learner.progress}%</span>
                        </div>
                        <Progress value={learner.progress} className="h-1.5" />
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Readiness score</span>
                        <span className="font-medium text-foreground">{learner.readiness}/100</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Invite Learner Modal ─────────────────────────────── */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div
            className="bg-background rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {inviteStep === 1 ? (
              /* ── Confirmation ── */
              <div className="flex flex-col items-center text-center px-8 py-12">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
                  <Check size={30} className="text-emerald-600" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">Learner added — message copied!</h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                  <span className="font-medium text-foreground">
                    {inviteForm.firstName} {inviteForm.lastName}
                  </span>{" "}
                  has been added to your learner list. The invitation message has been copied to your clipboard — paste it into an email to{" "}
                  <span className="font-medium text-foreground">{inviteForm.email}</span>.
                </p>

                <div className="w-full bg-muted/40 border border-border rounded-xl p-4 text-left mb-7 space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium text-foreground">{inviteForm.firstName} {inviteForm.lastName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium text-foreground">{inviteForm.email}</span>
                  </div>
                  {inviteForm.phone && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Phone</span>
                      <span className="font-medium text-foreground">{inviteForm.phone}</span>
                    </div>
                  )}
                  {inviteForm.program && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Program</span>
                      <span className="font-medium text-foreground">{inviteForm.program || "Not selected"}</span>
                    </div>
                  )}
                  {inviteForm.pathway && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pathway</span>
                      <span className="font-medium text-foreground">{inviteForm.pathway}</span>
                    </div>
                  )}
                  {inviteForm.coach && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Assigned coach</span>
                      <span className="font-medium text-foreground">{inviteForm.coach}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium text-foreground">New Learner</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-border text-xs mt-1">
                    <Mail size={11} className="text-muted-foreground" />
                    <span className="text-muted-foreground">Invitation message copied to clipboard · Paste into your email client</span>
                  </div>
                </div>

                <div className="flex gap-3 w-full">
                  <Button variant="outline" className="flex-1" onClick={closeInvite}>View Learner List</Button>
                  <Button className="flex-1" onClick={() => {
                    setInviteForm(BLANK_INVITE);
                    setInviteStep(0);
                    setInviteErrors({});
                  }}>
                    Invite Another
                  </Button>
                </div>
              </div>
            ) : (
              /* ── Compose invitation ── */
              <>
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Invite a Learner</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Add them to the program and copy a personal invitation to your clipboard</p>
                  </div>
                  <button onClick={closeInvite} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                  {/* Name row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium text-foreground">
                        First name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        className={`mt-1.5 h-10 text-sm ${inviteErrors.firstName ? "border-destructive" : ""}`}
                        placeholder="First name"
                        maxLength={50}
                        value={inviteForm.firstName}
                        onChange={(e) => setField("firstName", e.target.value)}
                        onBlur={() => validateField("firstName")}
                        data-testid="invite-first-name"
                      />
                      {inviteErrors.firstName && <p className="text-xs text-destructive mt-1">{inviteErrors.firstName}</p>}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-foreground">
                        Last name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        className={`mt-1.5 h-10 text-sm ${inviteErrors.lastName ? "border-destructive" : ""}`}
                        placeholder="Last name"
                        maxLength={50}
                        value={inviteForm.lastName}
                        onChange={(e) => setField("lastName", e.target.value)}
                        onBlur={() => validateField("lastName")}
                        data-testid="invite-last-name"
                      />
                      {inviteErrors.lastName && <p className="text-xs text-destructive mt-1">{inviteErrors.lastName}</p>}
                    </div>
                  </div>

                  {/* Email & phone */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium text-foreground">
                        Email address <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="email"
                        className={`mt-1.5 h-10 text-sm ${inviteErrors.email ? "border-destructive" : ""}`}
                        placeholder="learner@email.com"
                        maxLength={100}
                        value={inviteForm.email}
                        onChange={(e) => setField("email", e.target.value)}
                        onBlur={() => validateField("email")}
                        data-testid="invite-email"
                      />
                      {inviteErrors.email && <p className="text-xs text-destructive mt-1">{inviteErrors.email}</p>}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-foreground">
                        Phone <span className="text-muted-foreground font-normal">(optional)</span>
                      </Label>
                      <Input
                        type="tel"
                        className={`mt-1.5 h-10 text-sm ${inviteErrors.phone ? "border-destructive" : ""}`}
                        placeholder="(404) 555-0100"
                        maxLength={14}
                        value={inviteForm.phone}
                        onChange={(e) => setPhoneField(e.target.value)}
                        onBlur={() => validateField("phone")}
                      />
                      {inviteErrors.phone && <p className="text-xs text-destructive mt-1">{inviteErrors.phone}</p>}
                    </div>
                  </div>

                  {/* Pathway & Program */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium text-foreground">Pathway</Label>
                      <Select
                        value={inviteForm.pathway}
                        onValueChange={(v) => setInviteForm((f) => ({ ...f, pathway: v }))}
                      >
                        <SelectTrigger className="mt-1.5 h-10 text-sm">
                          <SelectValue placeholder="Select pathway..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allPathways.filter((p: any) => p.name).map((p: any) => (
                            <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-foreground">Program</Label>
                      <Select
                        value={inviteForm.program}
                        onValueChange={(v) => setField("program", v)}
                        disabled={!inviteForm.pathway}
                      >
                        <SelectTrigger className="mt-1.5 h-10 text-sm">
                          <SelectValue placeholder={inviteForm.pathway ? "Select program..." : "Select pathway first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const selectedPathway = allPathways.find((p: any) => p.name === inviteForm.pathway);
                            const linkedProgramIds = selectedPathway ? pathwayProgramLinks.filter(l => l.pathwayId === selectedPathway.id).map(l => l.programId) : [];
                            return allPrograms.filter((p: any) => p.name).map((p: any) => (
                              <SelectItem key={p.id} value={p.name}>
                                {linkedProgramIds.includes(p.id) ? `★ ${p.name}` : p.name}
                              </SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Coach */}
                  <div>
                    <Label className="text-sm font-medium text-foreground">Assign Coach</Label>
                    <Input
                      className="mt-1.5 h-10 text-sm"
                      placeholder="Enter coach name..."
                      value={inviteForm.coach}
                      onChange={(e) => setField("coach", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-foreground">Personal Message</Label>
                    <Textarea
                      className={`mt-1.5 text-sm resize-none ${inviteErrors.message ? "border-destructive" : ""}`}
                      rows={6}
                      maxLength={500}
                      value={inviteForm.message}
                      onChange={(e) => setField("message", e.target.value)}
                      onBlur={() => validateField("message")}
                      data-testid="invite-message"
                    />
                    <div className="flex justify-between mt-1">
                      {inviteErrors.message ? <p className="text-xs text-destructive">{inviteErrors.message}</p> : <span />}
                      <span className="text-xs text-muted-foreground">{inviteForm.message.length}/500</span>
                    </div>
                  </div>
                  {/*
                  <div className="col-span-2">
                    <Label>Assign Coach</Label>
                    <Select onValueChange={v => setField("coach", v)} value={inviteForm.coach}>
                      <SelectTrigger className="border-card-border">
                        <SelectValue placeholder="Select a coach" />
                      </SelectTrigger>
                      <SelectContent>
                        {coaches.map(c => (
                          <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  */}
                </div>

                <div className="flex gap-3 px-6 pb-6">
                  <Button variant="outline" onClick={closeInvite}>Cancel</Button>
                  <Button className="flex-1" onClick={handleSendInvite} data-testid="send-invite-btn">
                    <Mail size={13} className="mr-2" /> Add Learner & Copy Invitation
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Import CSV Dialog */}
      <Dialog open={showImport} onOpenChange={(open) => { if (!open) { setShowImport(false); setImportRows([]); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Learners from CSV</DialogTitle>
          </DialogHeader>

          {importRows.length === 0 ? (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">Upload a CSV file to bulk-import learners. Program and pathway values should match existing records.</p>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={() => {
                  const progNames = allPrograms.map((p: any) => p.name).join(" | ");
                  const pathNames = allPathways.map((p: any) => p.name).join(" | ");
                  const csv = [
                    "name,email,pathway,program,coach,status,readiness,progress",
                    `# REQUIRED,REQUIRED (unique),REQUIRED (${pathNames}),REQUIRED (${progNames}),REQUIRED,Optional (defaults to New Learner),Optional (0-100),Optional (0-100)`,
                    `Jane Smith,jane.smith@example.com,${allPathways[0]?.name || "Pathway Name"},${allPrograms[0]?.name || "Program Name"},Coach Name,New Learner,0,0`,
                    "",
                  ].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = "learners_template.csv"; a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download size={14} className="mr-1.5" /> Download Template
                </Button>
                <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={14} className="mr-1.5" /> Choose File
                </Button>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  Papa.parse(file, { header: true, skipEmptyLines: true, comments: "#", complete: (result) => setImportRows(result.data as Record<string, string>[]) });
                  e.target.value = "";
                }} />
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">{importRows.length} row{importRows.length !== 1 ? "s" : ""} found. Review before importing:</p>
              <div className="border rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">#</th>
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium">Email</th>
                      <th className="px-3 py-2 text-left font-medium">Program</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((row, i) => {
                      const isMissing = !row.name?.trim() || !row.email?.trim() || !row.pathway?.trim() || !row.program?.trim() || !row.coach?.trim();
                      const isDuplicate = allLearners.some(l => l.email.toLowerCase() === (row.email || "").toLowerCase().trim());
                      return (
                        <tr key={i} className={cn("border-t", isMissing && "bg-red-50", isDuplicate && !isMissing && "bg-amber-50")}>
                          <td className="px-3 py-1.5">{i + 1}</td>
                          <td className="px-3 py-1.5 font-medium">{row.name || <span className="text-red-500 italic">Missing</span>}</td>
                          <td className="px-3 py-1.5">{row.email || "—"}</td>
                          <td className="px-3 py-1.5">{row.program || "—"}</td>
                          <td className="px-3 py-1.5">
                            {isMissing && <span className="text-red-600 flex items-center gap-1"><X size={10} /> Invalid</span>}
                            {isDuplicate && !isMissing && <span className="text-amber-600 flex items-center gap-1"><AlertTriangle size={10} /> Duplicate email</span>}
                            {!isMissing && !isDuplicate && <span className="text-emerald-600 flex items-center gap-1"><Check size={10} /> Ready</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setImportRows([])}>Back</Button>
                <Button disabled={importing || importRows.every(r => !r.name?.trim())} onClick={async () => {
                  setImporting(true);
                  try {
                    const baseUrl = import.meta.env.VITE_API_URL || "";
                    const validRows = importRows.filter(r => r.name?.trim() && r.email?.trim() && r.pathway?.trim() && r.program?.trim() && r.coach?.trim()).map(r => ({
                      name: r.name.trim(),
                      email: r.email.trim(),
                      pathway: r.pathway.trim(),
                      program: r.program.trim(),
                      coach: r.coach.trim(),
                      status: r.status?.trim() || "New Learner",
                      readiness: parseInt(r.readiness) || 0,
                      progress: parseInt(r.progress) || 0,
                    }));
                    const res = await authFetch(`${baseUrl}/api/learners/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validRows) });
                    const result = await res.json();
                    queryClient.invalidateQueries({ queryKey: ["/api/learners"] });
                    toast({ title: "Import Complete", description: `${result.imported} learner${result.imported !== 1 ? "s" : ""} imported.${result.errors?.length ? ` ${result.errors.length} failed.` : ""}` });
                    setShowImport(false);
                    setImportRows([]);
                  } catch {
                    toast({ title: "Import Failed", description: "Something went wrong. Please try again.", variant: "destructive" });
                  } finally {
                    setImporting(false);
                  }
                }}>
                  {importing ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Importing...</> : <><Upload size={14} className="mr-1.5" /> Import {importRows.filter(r => r.name?.trim() && r.email?.trim() && r.program?.trim() && r.pathway?.trim() && r.coach?.trim()).length} Rows</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <Dialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} Learner{selectedIds.size > 1 ? "s" : ""}?</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">This will permanently delete the selected learners and all their associated data (roadmaps, projects, events, notes, etc.).</p>
            <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
              {[...selectedIds].map(id => {
                const l = allLearners.find(x => x.id === id);
                return l ? <li key={id} className="flex items-center gap-2"><Trash2 size={12} className="text-muted-foreground" />{l.name}</li> : null;
              })}
            </ul>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowBulkDelete(false)}>Cancel</Button>
            <Button variant="destructive" disabled={bulkDeleting} onClick={async () => {
              setBulkDeleting(true);
              try {
                const baseUrl = import.meta.env.VITE_API_URL || "";
                const res = await authFetch(`${baseUrl}/api/learners/bulk-delete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...selectedIds] }) });
                const result = await res.json();
                queryClient.invalidateQueries({ queryKey: ["/api/learners"] });
                setSelectedIds(new Set());
                setShowBulkDelete(false);
                toast({ title: "Deleted", description: `${result.deleted} learner${result.deleted !== 1 ? "s" : ""} deleted.` });
              } catch {
                toast({ title: "Error", description: "Failed to delete. Please try again.", variant: "destructive" });
              } finally {
                setBulkDeleting(false);
              }
            }}>
              {bulkDeleting ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Deleting...</> : "Confirm Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}