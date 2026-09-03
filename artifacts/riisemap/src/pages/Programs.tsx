import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Users, TrendingUp, Star, ChevronRight, Plus, X, Upload, Download, AlertTriangle, Check, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useGetPrograms, useGetLearners, useGetPathways, useCreateProgram, useUpdateProgram, useGetFundingSources, type Program, type Learner } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

const emptyForm = {
  name: "",
  programTag: "",
  description: "",
  pathwayCategory: "",
  cohort: "",
  startDate: "",
  endDate: "",
  funderTag: "",
  pathways: "",
};

export default function Programs() {
  const queryClient = useQueryClient();
  const { data: programList = [], isLoading: programsLoading } = useGetPrograms();
  const { data: learners = [] } = useGetLearners();
  const { data: fundingSources = [] } = useGetFundingSources();
  const { data: allPathways = [] } = useGetPathways();
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name-az" | "name-za">("newest");
  const sortedPrograms = [...programList].sort((a: any, b: any) => {
    if (sortBy === "newest") return b.id - a.id;
    if (sortBy === "oldest") return a.id - b.id;
    if (sortBy === "name-az") return a.name.localeCompare(b.name);
    return b.name.localeCompare(a.name);
  });
  const [pathwayProgramLinks, setPathwayProgramLinks] = useState<{ pathwayId: number; programId: number }[]>([]);

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || "";
    authFetch(`${baseUrl}/api/pathway-programs`).then(r => r.json()).then(setPathwayProgramLinks).catch(() => {});
  }, []);

  const getLinkedPathways = (programId: number) => {
    const linkedIds = pathwayProgramLinks.filter(l => l.programId === programId).map(l => l.pathwayId);
    return allPathways.filter((p: any) => linkedIds.includes(p.id));
  };

  const createProgramMutation = useCreateProgram({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/programs'] });
      }
    }
  });
  const updateProgramMutation = useUpdateProgram({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/programs'] });
      }
    }
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Multi-select & import state
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baseUrl = import.meta.env.VITE_API_URL || "";

  const program = programList.find(p => p.id === selected);

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Program name is required";
    else if (form.name.trim().length > 100) errs.name = "Program name must be 100 characters or less";
    if (!form.programTag.trim()) errs.programTag = "Program tag is required";
    else if (form.programTag.trim().length > 50) errs.programTag = "Program tag must be 50 characters or less";
    else if (!/^[a-z0-9-]+$/.test(form.programTag.trim())) errs.programTag = "Only lowercase letters, numbers, and hyphens";
    if (!form.description.trim()) errs.description = "Description is required";
    else if (form.description.trim().length > 500) errs.description = "Description must be 500 characters or less";
    if (!form.cohort.trim()) errs.cohort = "Cohort name is required";
    else if (form.cohort.trim().length > 50) errs.cohort = "Cohort must be 50 characters or less";
    if (!form.startDate.trim()) errs.startDate = "Start date is required";
    if (!form.endDate.trim()) errs.endDate = "End date is required";
    else if (form.startDate && form.endDate && form.startDate > form.endDate) errs.endDate = "End date must be after start date";
    if (!form.funderTag.trim()) errs.funderTag = "Funder is required";
    else if (form.funderTag.trim().length > 100) errs.funderTag = "Funder must be 100 characters or less";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateField = (field: keyof typeof form) => {
    let error = "";
    const value = form[field];
    switch (field) {
      case "name":
        if (!value.trim()) error = "Program name is required";
        else if (value.trim().length > 100) error = "Program name must be 100 characters or less";
        break;
      case "programTag":
        if (!value.trim()) error = "Program tag is required";
        else if (value.trim().length > 50) error = "Program tag must be 50 characters or less";
        else if (!/^[a-z0-9-]+$/.test(value.trim())) error = "Only lowercase letters, numbers, and hyphens";
        break;
      case "description":
        if (!value.trim()) error = "Description is required";
        else if (value.trim().length > 500) error = "Description must be 500 characters or less";
        break;
      case "cohort":
        if (!value.trim()) error = "Cohort name is required";
        else if (value.trim().length > 50) error = "Cohort must be 50 characters or less";
        break;
      case "startDate":
        if (!value.trim()) error = "Start date is required";
        break;
      case "endDate":
        if (!value.trim()) error = "End date is required";
        break;
      case "funderTag":
        if (!value.trim()) error = "Funder is required";
        else if (value.trim().length > 100) error = "Funder must be 100 characters or less";
        break;
    }
    setFormErrors(e => ({ ...e, [field]: error }));
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    try {
      await createProgramMutation.mutateAsync({
        data: {
          name: form.name.trim(),
          programTag: form.programTag.trim(),
          description: form.description.trim(),
          pathwayCategory: form.pathways.trim() || "General",
          activeLearners: 0,
          completionRate: 0,
          readinessScore: 0,
          eventParticipation: 0,
          placementReady: 0,
          funderTag: form.funderTag.trim(),
          cohort: form.cohort.trim(),
          startDate: form.startDate,
          endDate: form.endDate,
          pathways: form.pathways ? form.pathways.split(",").map(p => p.trim()).filter(Boolean) : [],
        }
      });
      setShowCreate(false);
      setForm(emptyForm);
      setFormErrors({});
    } catch (error: any) {
      if (error?.status === 409) {
        setFormErrors(e => ({ ...e, programTag: "This program tag is already in use" }));
      } else {
        console.error("Failed to create program:", error);
      }
    }
  };

  const openEdit = (p: Program) => {
    setEditingProgram(p);
    setForm({
      name: p.name,
      programTag: p.programTag || "",
      description: p.description,
      pathwayCategory: p.pathwayCategory,
      cohort: p.cohort,
      startDate: p.startDate,
      endDate: p.endDate,
      funderTag: p.funderTag,
      pathways: Array.isArray(p.pathways) ? p.pathways.join(", ") : "",
    });
    setFormErrors({});
  };

  const handleEdit = async () => {
    if (!validateForm() || !editingProgram) return;
    try {
      await updateProgramMutation.mutateAsync({
        id: editingProgram.id,
        data: {
          name: form.name.trim(),
          programTag: form.programTag.trim(),
          description: form.description.trim(),
          pathwayCategory: form.pathways.trim() || "General",
          activeLearners: editingProgram.activeLearners,
          completionRate: editingProgram.completionRate,
          readinessScore: editingProgram.readinessScore,
          eventParticipation: editingProgram.eventParticipation,
          placementReady: editingProgram.placementReady,
          funderTag: form.funderTag.trim(),
          cohort: form.cohort.trim(),
          startDate: form.startDate,
          endDate: form.endDate,
          pathways: form.pathways ? form.pathways.split(",").map(p => p.trim()).filter(Boolean) : [],
        }
      });
      setEditingProgram(null);
      setForm(emptyForm);
      setFormErrors({});
    } catch (error: any) {
      if (error?.status === 409) {
        setFormErrors(e => ({ ...e, programTag: "This program tag is already in use" }));
      } else {
        console.error("Failed to update program:", error);
      }
    }
  };

  const handleDeleteProgram = async () => {
    if (!deleteTarget || deleteConfirmText !== deleteTarget.name) return;
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "";
      const res = await authFetch(`${baseUrl}/api/programs/${deleteTarget.id}`, { method: "DELETE" });
      if (res.status === 409) {
        const data = await res.json();
        setDeleteTarget(null);
        setDeleteConfirmText("");
        alert(data.error || "Cannot delete a program that is assigned to a pathway.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['/api/programs'] });
      setSelected(null);
    } catch {
      alert("Failed to delete program.");
    }
    setDeleteTarget(null);
    setDeleteConfirmText("");
  };

  if (programsLoading) {
    return (
      <div className="px-6 py-8 max-w-5xl mx-auto">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading programs...</p>
        </div>
      </div>
    );
  }

  if (selected && program) {
    const programLearners = learners.filter(l => l.program === program.name);
    return (
      <div className="px-6 py-8 max-w-5xl mx-auto">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Programs
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{program.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{program.description}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0 ml-4">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { openEdit(program); setSelected(null); }}>Edit Program</Button>
            <Button variant="outline" size="sm" className="text-xs h-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ id: program.id, name: program.name })}>Delete</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Active Learners", value: program.activeLearners },
            { label: "Completion Rate", value: `${program.completionRate}%` },
            { label: "Readiness Score", value: program.readinessScore },
            { label: "Placement-Ready", value: program.placementReady },
          ].map(m => (
            <div key={m.label} className="bg-card border border-card-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="text-2xl font-semibold text-foreground mt-0.5">{m.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <Card className="border-card-border">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Program Details</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Cohort</span><span className="font-medium">{program.cohort}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Start Date</span><span className="font-medium">{program.startDate}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">End Date</span><span className="font-medium">{program.endDate}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Funder</span><span className="font-medium">{program.funderTag}</span></div>
            </CardContent>
          </Card>
          <Card className="border-card-border">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Linked Pathways</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-2">
              {getLinkedPathways(program.id).length === 0 ? (
                <p className="text-sm text-muted-foreground">No pathways linked yet.</p>
              ) : getLinkedPathways(program.id).map((pw: any) => (
                <div key={pw.id} className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-foreground">{pw.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{pw.estimatedWeeks} wks</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="border-card-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Learner Progress</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {programLearners.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No learners currently assigned to this program.</p>
            ) : (
              <div className="space-y-4">
                {programLearners.map(l => (
                  <div key={l.id} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <span className="text-xs font-bold text-primary">{l.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{l.name}</span>
                        <StatusBadge status={l.status} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={l.progress} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground w-8 text-right">{l.progress}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
            <div className="bg-background rounded-2xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-lg font-semibold text-foreground mb-2">Delete Program</h2>
              <p className="text-sm text-muted-foreground mb-4">
                This will permanently delete <span className="font-medium text-foreground">{deleteTarget.name}</span> and cannot be undone.
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                Type <span className="font-mono font-medium text-foreground">{deleteTarget.name}</span> to confirm:
              </p>
              <Input
                className="h-10 text-sm mb-4"
                placeholder="Type program name to confirm..."
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                autoFocus
              />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={deleteConfirmText !== deleteTarget.name}
                  onClick={handleDeleteProgram}
                >
                  Delete Program
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Programs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{programList.length} programs across Atlanta Workforce Tech Alliance</p>
          {programList.length > 0 && <p className="text-xs text-muted-foreground/70 mt-0.5">Select items with checkboxes to delete multiple at once</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
            <Upload size={14} className="mr-1.5" /> Import CSV
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} data-testid="create-program-btn">
            <Plus size={14} className="mr-1.5" /> Create Program
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-20 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 mb-4 shadow-sm">
          <span className="text-sm text-amber-800 font-medium">{selectedIds.size} program{selectedIds.size > 1 ? "s" : ""} selected</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setSelectedIds(new Set())}>Clear</Button>
            <Button variant="destructive" size="sm" className="text-xs h-7" onClick={() => setShowBulkDelete(true)}>
              <Trash2 size={12} className="mr-1" /> Delete Selected
            </Button>
          </div>
        </div>
      )}

      {programList.length === 0 ? (
        <Card className="border-card-border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Plus size={24} className="text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No Programs Yet</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-sm">
              Create your first program to organize learners into cohorts with shared timelines and funding sources.
            </p>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={13} className="mr-1.5" /> Create Your First Program
            </Button>
          </CardContent>
        </Card>
      ) : (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-muted-foreground">Sort by:</span>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="name-az">Name A–Z</SelectItem>
              <SelectItem value="name-za">Name Z–A</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {sortedPrograms.map(p => (
          <Card key={p.id} data-testid={`program-card-${p.id}`} className="border-card-border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Checkbox
                    checked={selectedIds.has(p.id)}
                    onCheckedChange={(checked) => {
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        if (checked) next.add(p.id); else next.delete(p.id);
                        return next;
                      });
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h2 className="text-base font-semibold text-foreground">{p.name}</h2>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">{p.funderTag}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{p.description}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Active Learners</p>
                      <p className="text-lg font-semibold text-foreground flex items-center gap-1"><Users size={14} className="text-primary" />{p.activeLearners}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Completion Rate</p>
                      <div>
                        <p className="text-sm font-semibold text-foreground mb-1">{p.completionRate}%</p>
                        <Progress value={p.completionRate} className="h-1.5" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Readiness Score</p>
                      <p className="text-lg font-semibold text-foreground flex items-center gap-1"><Star size={14} className="text-amber-500" />{p.readinessScore}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Placement-Ready</p>
                      <p className="text-lg font-semibold text-foreground flex items-center gap-1"><TrendingUp size={14} className="text-emerald-500" />{p.placementReady}</p>
                    </div>
                  </div>
                  {getLinkedPathways(p.id).length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-1.5">Linked Pathways</p>
                      <div className="flex flex-wrap gap-1.5">
                        {getLinkedPathways(p.id).map((pw: any) => (
                          <span key={pw.id} className="text-xs bg-muted px-2 py-0.5 rounded-full text-foreground">{pw.name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="outline" size="sm" className="text-xs h-8"
                    onClick={() => setSelected(p.id)}
                    data-testid={`view-program-${p.id}`}
                  >
                    View Program <ChevronRight size={12} className="ml-1" />
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => openEdit(p)}>Edit</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      )}

      {/* Create Program Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div
            className="bg-background rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border sticky top-0 bg-background z-10">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Create Program</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Add a new workforce program to the platform.</p>
              </div>
              <button onClick={() => { setShowCreate(false); setFormErrors({}); setForm(emptyForm); }} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <Label className="text-sm font-medium">Program Name <span className="text-destructive">*</span></Label>
                <Input
                  className={cn("mt-1.5 h-10 text-sm", formErrors.name && "border-destructive")}
                  placeholder="e.g. Cloud Operations Starter"
                  maxLength={100}
                  value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFormErrors(er => ({ ...er, name: "" })); }}
                  onBlur={() => validateField("name")}
                />
                {formErrors.name && <p className="text-xs text-destructive mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <Label className="text-sm font-medium">Program Tag <span className="text-destructive">*</span></Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">Unique identifier. Lowercase letters, numbers, and hyphens only.</p>
                <Input
                  className={cn("mt-1.5 h-10 text-sm", formErrors.programTag && "border-destructive")}
                  placeholder="e.g. cloud-ops-starter"
                  maxLength={50}
                  value={form.programTag}
                  onChange={e => { setForm(f => ({ ...f, programTag: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })); setFormErrors(er => ({ ...er, programTag: "" })); }}
                  onBlur={() => validateField("programTag")}
                />
                {formErrors.programTag && <p className="text-xs text-destructive mt-1">{formErrors.programTag}</p>}
              </div>

              <div>
                <Label className="text-sm font-medium">Description <span className="text-destructive">*</span></Label>
                <Textarea
                  className={cn("mt-1.5 text-sm resize-none", formErrors.description && "border-destructive")}
                  rows={3}
                  maxLength={500}
                  placeholder="Describe the program's goals, structure, and target learner..."
                  value={form.description}
                  onChange={e => { setForm(f => ({ ...f, description: e.target.value })); setFormErrors(er => ({ ...er, description: "" })); }}
                  onBlur={() => validateField("description")}
                />
                <div className="flex justify-between mt-1">
                  {formErrors.description ? <p className="text-xs text-destructive">{formErrors.description}</p> : <span />}
                  <span className="text-xs text-muted-foreground">{form.description.length}/500</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Cohort Name <span className="text-destructive">*</span></Label>
                  <Input
                    className={cn("mt-1.5 h-10 text-sm", formErrors.cohort && "border-destructive")}
                    placeholder="e.g. Summer 2025"
                    maxLength={50}
                    value={form.cohort}
                    onChange={e => { setForm(f => ({ ...f, cohort: e.target.value })); setFormErrors(er => ({ ...er, cohort: "" })); }}
                    onBlur={() => validateField("cohort")}
                  />
                  {formErrors.cohort && <p className="text-xs text-destructive mt-1">{formErrors.cohort}</p>}
                </div>
                <div>
                  <Label className="text-sm font-medium">Funder / Sponsor <span className="text-destructive">*</span></Label>
                  <Select value={form.funderTag} onValueChange={v => { setForm(f => ({ ...f, funderTag: v })); setFormErrors(er => ({ ...er, funderTag: "" })); }}>
                    <SelectTrigger className={cn("mt-1.5 h-10 text-sm", formErrors.funderTag && "border-destructive")}>
                      <SelectValue placeholder="Select a funding source..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fundingSources.map(fs => (
                        <SelectItem key={fs.id} value={fs.name}>{fs.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.funderTag && <p className="text-xs text-destructive mt-1">{formErrors.funderTag}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Start Date <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    className={cn("mt-1.5 h-10 text-sm", formErrors.startDate && "border-destructive")}
                    value={form.startDate}
                    onChange={e => { setForm(f => ({ ...f, startDate: e.target.value })); setFormErrors(er => ({ ...er, startDate: "" })); }}
                    onBlur={() => validateField("startDate")}
                  />
                  {formErrors.startDate && <p className="text-xs text-destructive mt-1">{formErrors.startDate}</p>}
                </div>
                <div>
                  <Label className="text-sm font-medium">End Date <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    className={cn("mt-1.5 h-10 text-sm", formErrors.endDate && "border-destructive")}
                    value={form.endDate}
                    onChange={e => { setForm(f => ({ ...f, endDate: e.target.value })); setFormErrors(er => ({ ...er, endDate: "" })); }}
                    onBlur={() => validateField("endDate")}
                  />
                  {formErrors.endDate && <p className="text-xs text-destructive mt-1">{formErrors.endDate}</p>}
                </div>
              </div>

            </div>

            <div className="flex gap-3 px-6 pb-6">
              <Button variant="outline" className="flex-1" onClick={() => { setShowCreate(false); setForm(emptyForm); setFormErrors({}); }}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleCreate} data-testid="submit-program-btn">
                Create Program
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Program Modal */}
      {editingProgram && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-background rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border sticky top-0 bg-background z-10">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Edit Program</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Update program details.</p>
              </div>
              <button onClick={() => { setEditingProgram(null); setForm(emptyForm); setFormErrors({}); }} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <Label className="text-sm font-medium">Program Name <span className="text-destructive">*</span></Label>
                <Input
                  className={cn("mt-1.5 h-10 text-sm", formErrors.name && "border-destructive")}
                  maxLength={100}
                  value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFormErrors(er => ({ ...er, name: "" })); }}
                  onBlur={() => validateField("name")}
                />
                {formErrors.name && <p className="text-xs text-destructive mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <Label className="text-sm font-medium">Program Tag <span className="text-destructive">*</span></Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">Unique identifier. Lowercase letters, numbers, and hyphens only.</p>
                <Input
                  className={cn("mt-1.5 h-10 text-sm", formErrors.programTag && "border-destructive")}
                  maxLength={50}
                  value={form.programTag}
                  onChange={e => { setForm(f => ({ ...f, programTag: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })); setFormErrors(er => ({ ...er, programTag: "" })); }}
                  onBlur={() => validateField("programTag")}
                />
                {formErrors.programTag && <p className="text-xs text-destructive mt-1">{formErrors.programTag}</p>}
              </div>

              <div>
                <Label className="text-sm font-medium">Description <span className="text-destructive">*</span></Label>
                <Textarea
                  className={cn("mt-1.5 text-sm resize-none", formErrors.description && "border-destructive")}
                  rows={3}
                  maxLength={500}
                  value={form.description}
                  onChange={e => { setForm(f => ({ ...f, description: e.target.value })); setFormErrors(er => ({ ...er, description: "" })); }}
                  onBlur={() => validateField("description")}
                />
                <div className="flex justify-between mt-1">
                  {formErrors.description ? <p className="text-xs text-destructive">{formErrors.description}</p> : <span />}
                  <span className="text-xs text-muted-foreground">{form.description.length}/500</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Cohort Name <span className="text-destructive">*</span></Label>
                  <Input
                    className={cn("mt-1.5 h-10 text-sm", formErrors.cohort && "border-destructive")}
                    maxLength={50}
                    value={form.cohort}
                    onChange={e => { setForm(f => ({ ...f, cohort: e.target.value })); setFormErrors(er => ({ ...er, cohort: "" })); }}
                    onBlur={() => validateField("cohort")}
                  />
                  {formErrors.cohort && <p className="text-xs text-destructive mt-1">{formErrors.cohort}</p>}
                </div>
                <div>
                  <Label className="text-sm font-medium">Funder / Sponsor <span className="text-destructive">*</span></Label>
                  <Select value={form.funderTag} onValueChange={v => { setForm(f => ({ ...f, funderTag: v })); setFormErrors(er => ({ ...er, funderTag: "" })); }}>
                    <SelectTrigger className={cn("mt-1.5 h-10 text-sm", formErrors.funderTag && "border-destructive")}>
                      <SelectValue placeholder="Select a funding source..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fundingSources.map(fs => (
                        <SelectItem key={fs.id} value={fs.name}>{fs.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.funderTag && <p className="text-xs text-destructive mt-1">{formErrors.funderTag}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Start Date <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    className={cn("mt-1.5 h-10 text-sm", formErrors.startDate && "border-destructive")}
                    value={form.startDate}
                    onChange={e => { setForm(f => ({ ...f, startDate: e.target.value })); setFormErrors(er => ({ ...er, startDate: "" })); }}
                    onBlur={() => validateField("startDate")}
                  />
                  {formErrors.startDate && <p className="text-xs text-destructive mt-1">{formErrors.startDate}</p>}
                </div>
                <div>
                  <Label className="text-sm font-medium">End Date <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    className={cn("mt-1.5 h-10 text-sm", formErrors.endDate && "border-destructive")}
                    value={form.endDate}
                    onChange={e => { setForm(f => ({ ...f, endDate: e.target.value })); setFormErrors(er => ({ ...er, endDate: "" })); }}
                    onBlur={() => validateField("endDate")}
                  />
                  {formErrors.endDate && <p className="text-xs text-destructive mt-1">{formErrors.endDate}</p>}
                </div>
              </div>

            </div>

            <div className="flex gap-3 px-6 pb-6">
              <Button variant="outline" className="flex-1" onClick={() => { setEditingProgram(null); setForm(emptyForm); setFormErrors({}); }}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleEdit}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-background rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">Delete Program</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This will permanently delete <span className="font-medium text-foreground">{deleteTarget.name}</span> and cannot be undone.
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              Type <span className="font-mono font-medium text-foreground">{deleteTarget.name}</span> to confirm:
            </p>
            <Input
              className="h-10 text-sm mb-4"
              placeholder="Type program name to confirm..."
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleteConfirmText !== deleteTarget.name}
                onClick={handleDeleteProgram}
              >
                Delete Program
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      <Dialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} Program{selectedIds.size > 1 ? "s" : ""}?</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">Programs assigned to a pathway cannot be deleted and will be skipped.</p>
            <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
              {[...selectedIds].map(id => {
                const p = programList.find(x => x.id === id);
                return p ? <li key={id} className="flex items-center gap-2"><Trash2 size={12} className="text-muted-foreground" />{p.name}</li> : null;
              })}
            </ul>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowBulkDelete(false)}>Cancel</Button>
            <Button variant="destructive" disabled={bulkDeleting} onClick={async () => {
              setBulkDeleting(true);
              try {
                const res = await authFetch(`${baseUrl}/api/programs/bulk-delete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...selectedIds] }) });
                const result = await res.json();
                queryClient.invalidateQueries({ queryKey: ["/api/programs"] });
                setSelectedIds(new Set());
                setShowBulkDelete(false);
                if (result.blocked?.length > 0) {
                  toast({ title: "Partially Deleted", description: `${result.deleted} deleted. ${result.blocked.length} skipped (assigned to pathways).` });
                } else {
                  toast({ title: "Deleted", description: `${result.deleted} program${result.deleted !== 1 ? "s" : ""} deleted.` });
                }
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

      {/* Import CSV Dialog */}
      <Dialog open={showImport} onOpenChange={(open) => { if (!open) { setShowImport(false); setImportRows([]); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Programs from CSV</DialogTitle>
          </DialogHeader>

          {importRows.length === 0 ? (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">Upload a CSV file to bulk-import programs. The funderTag column should match the name of an existing funding source.</p>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={() => {
                  const csv = [
                    "name,programTag,description,pathwayCategory,funderTag,cohort,startDate,endDate",
                    "# REQUIRED (max 255),REQUIRED unique identifier,REQUIRED description,REQUIRED category,REQUIRED (must match existing funding source),REQUIRED (e.g. Spring 2026),REQUIRED (YYYY-MM-DD),REQUIRED (YYYY-MM-DD)",
                    "Tech Career Launch,tech-launch-spring26,\"Prepare learners for tech careers through structured coaching\",Technology,Example Grant,Spring 2026,2026-01-15,2026-06-30",
                    "",
                  ].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = "programs_template.csv"; a.click();
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
                      <th className="px-3 py-2 text-left font-medium">Tag</th>
                      <th className="px-3 py-2 text-left font-medium">Funder</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((row, i) => {
                      const isMissing = !row.name?.trim() || !row.programTag?.trim();
                      const isDuplicate = programList.some(p => p.programTag === row.programTag?.trim());
                      const funderMatch = fundingSources.some(f => f.name.toLowerCase().trim() === (row.funderTag || "").toLowerCase().trim());
                      return (
                        <tr key={i} className={cn("border-t", isMissing && "bg-red-50", isDuplicate && !isMissing && "bg-amber-50")}>
                          <td className="px-3 py-1.5">{i + 1}</td>
                          <td className="px-3 py-1.5 font-medium">{row.name || <span className="text-red-500 italic">Missing</span>}</td>
                          <td className="px-3 py-1.5">{row.programTag || "—"}</td>
                          <td className="px-3 py-1.5">{row.funderTag}{row.funderTag && !funderMatch && <AlertTriangle size={10} className="inline ml-1 text-amber-500" />}</td>
                          <td className="px-3 py-1.5">
                            {isMissing && <span className="text-red-600 flex items-center gap-1"><X size={10} /> Invalid</span>}
                            {isDuplicate && !isMissing && <span className="text-amber-600 flex items-center gap-1"><AlertTriangle size={10} /> Duplicate tag</span>}
                            {!isMissing && !isDuplicate && <span className="text-emerald-600 flex items-center gap-1"><Check size={10} /> Ready</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {importRows.some(r => r.funderTag && !fundingSources.some(f => f.name.toLowerCase().trim() === r.funderTag.toLowerCase().trim())) && (
                <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle size={12} /> Some funder names don't match existing funding sources. They will be imported as-is.</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setImportRows([])}>Back</Button>
                <Button disabled={importing || importRows.every(r => !r.name?.trim())} onClick={async () => {
                  setImporting(true);
                  try {
                    const validRows = importRows.filter(r => r.name?.trim() && r.programTag?.trim()).map(r => ({
                      name: r.name.trim(),
                      programTag: r.programTag.trim(),
                      description: r.description?.trim() || "",
                      pathwayCategory: r.pathwayCategory?.trim() || "",
                      funderTag: r.funderTag?.trim() || "",
                      cohort: r.cohort?.trim() || "",
                      startDate: r.startDate?.trim() || "",
                      endDate: r.endDate?.trim() || "",
                    }));
                    const res = await authFetch(`${baseUrl}/api/programs/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validRows) });
                    const result = await res.json();
                    queryClient.invalidateQueries({ queryKey: ["/api/programs"] });
                    toast({ title: "Import Complete", description: `${result.imported} program${result.imported !== 1 ? "s" : ""} imported.${result.errors?.length ? ` ${result.errors.length} failed.` : ""}` });
                    setShowImport(false);
                    setImportRows([]);
                  } catch {
                    toast({ title: "Import Failed", description: "Something went wrong. Please try again.", variant: "destructive" });
                  } finally {
                    setImporting(false);
                  }
                }}>
                  {importing ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Importing...</> : <><Upload size={14} className="mr-1.5" /> Import {importRows.filter(r => r.name?.trim() && r.programTag?.trim()).length} Rows</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
