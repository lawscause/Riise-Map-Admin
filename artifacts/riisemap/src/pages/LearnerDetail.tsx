import { useState, useRef, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  ArrowLeft, User, BookOpen, FolderKanban, Calendar,
  FileText, BarChart3, Activity, Plus, Flag, CheckSquare,
  Clock, ChevronRight, CheckCircle2, Circle, AlertCircle, Check,
  Upload, Edit, Trash2, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useGetLearner, useUpdateLearner, type Learner,
  useGetLearnerRoadmaps, useGetLearnerProjects, useGetLearnerEvents,
  useGetLearnerNotes, useCreateLearnerNote, useUpdateLearnerNote, useDeleteLearnerNote,
  useGetLearnerReadiness, useGetLearnerActivities,
  useGetPrograms, useGetPathways
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/lib/UserContext";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth-fetch";
import { apiErrorMessage } from "@/lib/api-error";

const DELETE_LEARNER_FALLBACK = "Failed to delete learner";

export default function LearnerDetail() {
  const { id } = useParams<{ id: string }>();
  const learnerId = parseInt(id || "0");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useUser();
  const { data: learner, isLoading } = useGetLearner(learnerId);
  const { data: programs = [] } = useGetPrograms();
  const { data: pathways = [] } = useGetPathways();
  const updateLearnerMutation = useUpdateLearner({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/learners/${learnerId}`] }) } });
  const { data: roadmap = [] } = useGetLearnerRoadmaps(learnerId);
  const { data: projects = [] } = useGetLearnerProjects(learnerId);
  const { data: events = [] } = useGetLearnerEvents(learnerId);
  const { data: notes = [] } = useGetLearnerNotes(learnerId);
  const { data: readiness = [] } = useGetLearnerReadiness(learnerId);
  const { data: activity = [] } = useGetLearnerActivities(learnerId);
  const createNoteMutation = useCreateLearnerNote(learnerId);
  const updateNoteMutation = useUpdateLearnerNote(learnerId);
  const deleteNoteMutation = useDeleteLearnerNote(learnerId);
  const [newNote, setNewNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("notes");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [, navigate] = useLocation();
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [pathwayProgramLinks, setPathwayProgramLinks] = useState<{ pathwayId: number; programId: number }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || "";
    authFetch(`${baseUrl}/api/learner-statuses`).then(r => r.json()).then((data: any[]) => setStatusOptions(data.map(s => s.name))).catch(() => {});
    authFetch(`${baseUrl}/api/pathway-programs`).then(r => r.json()).then(setPathwayProgramLinks).catch(() => {});
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const photoUrl = reader.result as string;
        updateLearnerMutation.mutate({ id: learnerId, data: { ...learner!, photo: photoUrl } });
      };
      reader.readAsDataURL(file);
    }
  };

  if (isLoading) {
    return (
      <div className="px-6 py-8 max-w-5xl mx-auto">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading learner details...</p>
        </div>
      </div>
    );
  }

  if (!learner) {
    return (
      <div className="px-6 py-8 max-w-5xl mx-auto">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Learner not found</p>
          <Link href="/learners">
            <Button variant="outline" size="sm" className="mt-4">
              Back to Learners
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const strengths: string[] = typeof learner.strengths === 'string' ? JSON.parse(learner.strengths) : learner.strengths || [];
  const risks: string[] = typeof learner.risks === 'string' ? JSON.parse(learner.risks) : learner.risks || [];

  function handleFlag() {
    updateLearnerMutation.mutate({ id: learnerId, data: { ...learner!, flaggedForSupport: !learner!.flaggedForSupport } });
  }

  function startEditing() {
    setEditForm({ name: learner!.name, email: learner!.email, pathway: learner!.pathway, program: learner!.program, coach: learner!.coach, status: learner!.status, readiness: String(learner!.readiness), progress: String(learner!.progress), lastActive: learner!.lastActive });
    setIsEditing(true);
  }

  function saveEdit() {
    updateLearnerMutation.mutate({ id: learnerId, data: { ...learner!, ...editForm, readiness: Number(editForm.readiness), progress: Number(editForm.progress) } });
    setIsEditing(false);
  }

  /**
   * Failure leaves the confirm dialog open so the user can retry or cancel;
   * only a confirmed 2xx leaves the page, after the list cache is invalidated
   * so the learners table cannot show the deleted row.
   */
  async function handleDeleteLearner() {
    if (deleteConfirmText !== learner!.name) return;
    const baseUrl = import.meta.env.VITE_API_URL || "";
    try {
      const res = await authFetch(`${baseUrl}/api/learners/${learnerId}`, { method: "DELETE" });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        toast({ title: "Error", description: apiErrorMessage(body, DELETE_LEARNER_FALLBACK), variant: "destructive" });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/learners"] });
      navigate("/learners");
    } catch {
      toast({ title: "Error", description: DELETE_LEARNER_FALLBACK, variant: "destructive" });
    }
  }

  function handleSaveNote() {
    const trimmed = newNote.trim();
    if (!trimmed) return;
    createNoteMutation.mutate(
      { author: user.fullName || "Unknown", date: new Date().toISOString().split("T")[0], content: trimmed },
      { onSuccess: () => { setNewNote(""); setNoteSaved(true); setTimeout(() => setNoteSaved(false), 2000); } }
    );
  }

  const milestoneIcon = (state: string) => {
    if (state === "completed") return <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />;
    if (state === "in-progress") return <Clock size={16} className="text-blue-500 flex-shrink-0" />;
    if (state === "overdue") return <AlertCircle size={16} className="text-red-500 flex-shrink-0" />;
    return <Circle size={16} className="text-muted-foreground/40 flex-shrink-0" />;
  };

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      {/* Back */}
      <Link href="/learners">
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
          <ArrowLeft size={14} />
          Back to Learners
        </button>
      </Link>

      {/* Header */}
      {isEditing ? (
        <div className="bg-card border border-card-border rounded-lg p-5 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-muted-foreground">Name</label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
            <div><label className="text-xs font-medium text-muted-foreground">Email</label><Input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="mt-1" /></div>
            <div><label className="text-xs font-medium text-muted-foreground">Pathway</label>
              <Select value={editForm.pathway} onValueChange={v => setEditForm(f => ({ ...f, pathway: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select pathway..." /></SelectTrigger>
                <SelectContent>
                  {pathways.filter((p: any) => p.name).map((p: any) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-xs font-medium text-muted-foreground">Program</label>
              <Select value={editForm.program} onValueChange={v => setEditForm(f => ({ ...f, program: v }))} disabled={!editForm.pathway}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={editForm.pathway ? "Select program..." : "Select pathway first"} /></SelectTrigger>
                <SelectContent>
                  {(() => {
                    const selectedPathway = pathways.find((p: any) => p.name === editForm.pathway);
                    const linkedProgramIds = selectedPathway ? pathwayProgramLinks.filter(l => l.pathwayId === selectedPathway.id).map(l => l.programId) : [];
                    return programs.filter((p: any) => p.name).map((p: any) => (
                      <SelectItem key={p.id} value={p.name}>{linkedProgramIds.includes(p.id) ? `★ ${p.name}` : p.name}</SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-xs font-medium text-muted-foreground">Coach</label><Input value={editForm.coach} onChange={e => setEditForm(f => ({ ...f, coach: e.target.value }))} className="mt-1" /></div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.filter(s => s).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t">
            <div className="bg-muted/30 border rounded-lg p-3">
              <label className="text-xs font-medium text-muted-foreground">Readiness Score</label>
              <div className="flex items-center gap-2 mt-2">
                <Slider
                  value={[Number(editForm.readiness) || 0]}
                  max={100}
                  step={1}
                  className="flex-1"
                  trackColor={Number(editForm.readiness) <= 25 ? "#9ca3af" : Number(editForm.readiness) <= 50 ? "#3b82f6" : Number(editForm.readiness) <= 75 ? "#f59e0b" : "#22c55e"}
                  onValueChange={([val]) => setEditForm(f => ({ ...f, readiness: String(val) }))}
                />
                <input type="number" min={0} max={100} value={editForm.readiness} onChange={e => setEditForm(f => ({ ...f, readiness: String(Math.min(100, Math.max(0, parseInt(e.target.value) || 0))) }))} className="w-12 h-7 text-sm text-center border rounded-md" />
              </div>
            </div>
            <div className="bg-muted/30 border rounded-lg p-3">
              <label className="text-xs font-medium text-muted-foreground">Roadmap Progress</label>
              <div className="flex items-center gap-2 mt-2">
                <Slider
                  value={[Number(editForm.progress) || 0]}
                  max={100}
                  step={1}
                  className="flex-1"
                  trackColor={Number(editForm.progress) <= 25 ? "#9ca3af" : Number(editForm.progress) <= 50 ? "#3b82f6" : Number(editForm.progress) <= 75 ? "#f59e0b" : "#22c55e"}
                  onValueChange={([val]) => setEditForm(f => ({ ...f, progress: String(val) }))}
                />
                <input type="number" min={0} max={100} value={editForm.progress} onChange={e => setEditForm(f => ({ ...f, progress: String(Math.min(100, Math.max(0, parseInt(e.target.value) || 0))) }))} className="w-12 h-7 text-sm text-center border rounded-md" />
              </div>
            </div>
            <div className="bg-muted/30 border rounded-lg p-3">
              <label className="text-xs font-medium text-muted-foreground">Profile Strength</label>
              {(() => {
                const fields = [editForm.name, editForm.email, editForm.program, editForm.pathway, editForm.coach, editForm.status];
                const filled = fields.filter(f => f && f.trim()).length + (Number(editForm.readiness) > 0 ? 1 : 0) + (Number(editForm.progress) > 0 ? 1 : 0);
                const pct = Math.round((filled / 8) * 100);
                const color = pct <= 25 ? "#ef4444" : pct <= 50 ? "#3b82f6" : pct <= 75 ? "#f59e0b" : "#22c55e";
                return (
                  <>
                    <p className="text-2xl font-semibold text-foreground mt-2">{pct}%</p>
                    <div className="h-1 mt-1.5 w-full rounded-full bg-primary/20 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="bg-muted/30 border rounded-lg p-3">
              <label className="text-xs font-medium text-muted-foreground">Created</label>
              <p className="text-sm font-semibold text-foreground mt-2">{learner.createdAt ? new Date(learner.createdAt).toLocaleDateString() : "—"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="text-xs h-8" onClick={saveEdit}><Check size={12} className="mr-1.5" />Save</Button>
            <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => setIsEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div 
            className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden"
          >
            <span className="text-lg font-semibold text-primary/80">{learner.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-semibold text-foreground" data-testid="learner-name">{learner.name}</h1>
              <StatusBadge status={learner.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{learner.pathway} · Coach: {learner.coach}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={startEditing}>
            <Edit size={12} className="mr-1.5" /> Edit
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-8 text-destructive hover:text-destructive" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 size={12} className="mr-1.5" /> Delete
          </Button>
        </div>
      </div>
      )}

      {/* Key metrics */}
      {!isEditing && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-card border border-card-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Readiness Score</p>
          <p className="text-2xl font-semibold mt-0.5" style={{ color: learner.readiness <= 25 ? "#9ca3af" : learner.readiness <= 50 ? "#3b82f6" : learner.readiness <= 75 ? "#f59e0b" : "#22c55e" }} data-testid="readiness-score">{learner.readiness}</p>
          <p className="text-xs text-muted-foreground mt-1">out of 100</p>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Roadmap Progress</p>
          <p className="text-2xl font-semibold text-foreground mt-0.5">{learner.progress}%</p>
          <div className="h-1 mt-1.5 w-full rounded-full bg-primary/20 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${learner.progress}%`, backgroundColor: learner.progress <= 25 ? "#9ca3af" : learner.progress <= 50 ? "#3b82f6" : learner.progress <= 75 ? "#f59e0b" : "#22c55e" }} />
          </div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Profile Strength</p>
          {(() => {
            const fields = [learner.name, learner.email, learner.program, learner.pathway, learner.coach, learner.status];
            const filled = fields.filter(f => f && f.trim()).length
              + (learner.readiness > 0 ? 1 : 0)
              + (learner.progress > 0 ? 1 : 0);
            const pct = Math.round((filled / 8) * 100);
            const color = pct <= 25 ? "#ef4444" : pct <= 50 ? "#3b82f6" : pct <= 75 ? "#f59e0b" : "#22c55e";
            return (
              <>
                <p className="text-2xl font-semibold text-foreground mt-0.5">{pct}%</p>
                <div className="h-1 mt-1.5 w-full rounded-full bg-primary/20 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </>
            );
          })()}
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Created</p>
          <p className="text-sm font-semibold text-foreground mt-1">{learner.createdAt ? new Date(learner.createdAt).toLocaleDateString() : "—"}</p>
        </div>
      </div>
      )}

      {/* Tabs */}
      {!isEditing && (
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-5 bg-muted/50">
          <TabsTrigger value="notes" className="text-xs"><FileText size={12} className="mr-1" />Notes</TabsTrigger>
        </TabsList>

        {/* Notes */}
        <TabsContent value="notes">
          <div className="space-y-4">
            <Card className="border-card-border">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Add a note</p>
                <Textarea
                  placeholder="Share an observation, update, or next step for this learner..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="text-sm min-h-20 resize-none"
                  data-testid="add-note-input"
                />
                <div className="flex items-center justify-end gap-2 mt-2">
                  {noteSaved && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                      <Check size={12} /> Saved
                    </span>
                  )}
                  <Button size="sm" className="text-xs h-8" disabled={!newNote.trim()} onClick={handleSaveNote} data-testid="save-note-btn">
                    Save Note
                  </Button>
                </div>
              </CardContent>
            </Card>
            {notes.map(n => (
              <Card key={n.id} className="border-card-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-primary">{n.author.split(" ").map(x => x[0]).join("")}</span>
                      </div>
                      <span className="text-xs font-semibold text-foreground">{n.author}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{n.date}</span>
                      {editingNoteId !== n.id && (
                        <>
                          <button onClick={() => { setEditingNoteId(n.id); setEditingContent(n.content); }} className="text-muted-foreground hover:text-foreground"><Edit size={12} /></button>
                          <button onClick={() => deleteNoteMutation.mutate(n.id)} className="text-muted-foreground hover:text-red-600"><Trash2 size={12} /></button>
                        </>
                      )}
                    </div>
                  </div>
                  {editingNoteId === n.id ? (
                    <div>
                      <Textarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} className="text-sm min-h-16 resize-none" />
                      <div className="flex justify-end gap-2 mt-2">
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setEditingNoteId(null)}><X size={12} className="mr-1" />Cancel</Button>
                        <Button size="sm" className="text-xs h-7" onClick={() => updateNoteMutation.mutate({ noteId: n.id, content: editingContent }, { onSuccess: () => setEditingNoteId(null) })}>Save</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{n.content}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-background rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">Delete Learner</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This will permanently delete <span className="font-medium text-foreground">{learner.name}</span> and all their associated data. This cannot be undone.
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              Type <span className="font-mono font-medium text-foreground">{learner.name}</span> to confirm:
            </p>
            <Input
              className="h-10 text-sm mb-4"
              placeholder="Type learner name to confirm..."
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleteConfirmText !== learner.name}
                onClick={handleDeleteLearner}
              >
                Delete Learner
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
