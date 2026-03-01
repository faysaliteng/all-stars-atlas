import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search, Plus, Eye, Edit2, Save, Trash2, ArrowLeft, ArrowUp, ArrowDown,
  FileText, Globe, ChevronRight, GripVertical
} from "lucide-react";
import { toast } from "sonner";
import { CMS_PAGE_DEFAULTS, type CmsPageContent, type ContentSection, type FAQCategory } from "@/lib/cms-defaults";
import { useCmsSavePage } from "@/hooks/useCmsContent";

const allPages = Object.values(CMS_PAGE_DEFAULTS);

const CMSPages = () => {
  const [search, setSearch] = useState("");
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<CmsPageContent | null>(null);
  const saveMutation = useCmsSavePage();

  const filtered = allPages.filter(p =>
    p.pageTitle.toLowerCase().includes(search.toLowerCase()) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  );

  const startEditing = (slug: string) => {
    const page = CMS_PAGE_DEFAULTS[slug];
    if (page) {
      setEditContent(JSON.parse(JSON.stringify(page))); // deep clone
      setEditingSlug(slug);
    }
  };

  const handleSave = () => {
    if (!editContent) return;
    saveMutation.mutate(editContent, {
      onSuccess: () => toast.success(`"${editContent.pageTitle}" saved successfully!`),
    });
  };

  // ====== PAGE LIST VIEW ======
  if (!editingSlug || !editContent) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">All Pages — Content Editor</h1>
            <p className="text-sm text-muted-foreground mt-1">{allPages.length} pages • Click "Edit" to modify any page content</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search pages..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="grid gap-3">
          {filtered.map((page) => {
            const isService = !!page.serviceContent;
            const hasSections = (page.sections?.length || 0) > 0;
            const hasFaq = (page.faqCategories?.length || 0) > 0;
            const typeLabel = isService ? "Service" : hasSections ? "Legal/Policy" : hasFaq ? "FAQ" : "Content";
            return (
              <Card key={page.slug} className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {isService ? <Globe className="w-5 h-5 text-primary" /> : <FileText className="w-5 h-5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">{page.pageTitle}</h3>
                    <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{page.slug}</code>
                  </div>
                  <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">{typeLabel}</Badge>
                  <Button size="sm" variant="outline" onClick={() => window.open(page.slug, "_blank")} className="hidden sm:flex">
                    <Eye className="w-3.5 h-3.5 mr-1" /> Preview
                  </Button>
                  <Button size="sm" onClick={() => startEditing(page.slug)}>
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ====== PAGE EDITOR VIEW ======
  const pageType = editContent.serviceContent ? "service" :
    editContent.sections ? "sections" :
    editContent.faqCategories ? "faq" :
    editContent.refundPolicies ? "refund" :
    editContent.positions ? "careers" :
    editContent.contactInfo ? "contact" :
    editContent.team ? "about" :
    editContent.blogPosts ? "blog" : "generic";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { setEditingSlug(null); setEditContent(null); }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Edit: {editContent.pageTitle}</h1>
            <code className="text-xs text-muted-foreground">{editContent.slug}</code>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open(editContent.slug, "_blank")}>
            <Eye className="w-4 h-4 mr-1.5" /> Preview
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-1.5" /> {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Hero Section (all pages have this) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Page Hero / Header</CardTitle>
          <CardDescription className="text-xs">The main banner section at the top of the page</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Page Title (H1)</Label>
              <Input value={editContent.hero.title} onChange={(e) => setEditContent({ ...editContent, hero: { ...editContent.hero, title: e.target.value } })} className="h-9" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Subtitle</Label>
              <Input value={editContent.hero.subtitle} onChange={(e) => setEditContent({ ...editContent, hero: { ...editContent.hero, subtitle: e.target.value } })} className="h-9" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Gradient (CSS)</Label>
            <Input value={editContent.hero.gradient || ""} onChange={(e) => setEditContent({ ...editContent, hero: { ...editContent.hero, gradient: e.target.value } })} className="h-9 font-mono text-xs" placeholder="from-[hsl(217,91%,50%)] to-[hsl(224,70%,28%)]" />
          </div>
        </CardContent>
      </Card>

      {/* ====== SECTION-BASED PAGES (Terms, Privacy) ====== */}
      {pageType === "sections" && editContent.sections && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Content Sections</CardTitle>
              <Button size="sm" onClick={() => {
                const newSections = [...(editContent.sections || [])];
                newSections.push({ id: String(Date.now()), title: "New Section", content: "", visible: true, order: newSections.length });
                setEditContent({ ...editContent, sections: newSections });
              }}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Section
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editContent.sections.sort((a, b) => a.order - b.order).map((section, idx) => (
              <div key={section.id} className={`border rounded-lg p-4 space-y-3 ${!section.visible ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <Badge variant="outline" className="text-[10px]">#{idx + 1}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => {
                      const s = [...editContent.sections!];
                      [s[idx].order, s[idx - 1].order] = [s[idx - 1].order, s[idx].order];
                      setEditContent({ ...editContent, sections: s });
                    }}><ArrowUp className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === editContent.sections!.length - 1} onClick={() => {
                      const s = [...editContent.sections!];
                      [s[idx].order, s[idx + 1].order] = [s[idx + 1].order, s[idx].order];
                      setEditContent({ ...editContent, sections: s });
                    }}><ArrowDown className="w-3.5 h-3.5" /></Button>
                    <Switch checked={section.visible} onCheckedChange={(v) => {
                      const s = [...editContent.sections!];
                      s[idx] = { ...s[idx], visible: v };
                      setEditContent({ ...editContent, sections: s });
                    }} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                      setEditContent({ ...editContent, sections: editContent.sections!.filter((_, i) => i !== idx) });
                    }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Section Title</Label>
                  <Input value={section.title} onChange={(e) => {
                    const s = [...editContent.sections!];
                    s[idx] = { ...s[idx], title: e.target.value };
                    setEditContent({ ...editContent, sections: s });
                  }} className="h-8 text-sm font-semibold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Content</Label>
                  <Textarea value={section.content} onChange={(e) => {
                    const s = [...editContent.sections!];
                    s[idx] = { ...s[idx], content: e.target.value };
                    setEditContent({ ...editContent, sections: s });
                  }} rows={3} className="text-sm" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ====== ABOUT PAGE ====== */}
      {pageType === "about" && (
        <>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Our Story</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={editContent.storyText || ""} onChange={(e) => setEditContent({ ...editContent, storyText: e.target.value })} rows={5} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Company Values</CardTitle>
                <Button size="sm" onClick={() => {
                  setEditContent({ ...editContent, values: [...(editContent.values || []), { icon: "Target", title: "New Value", desc: "" }] });
                }}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {editContent.values?.map((v, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                  <Input value={v.icon} onChange={(e) => { const vs = [...editContent.values!]; vs[idx] = { ...vs[idx], icon: e.target.value }; setEditContent({ ...editContent, values: vs }); }} className="h-8 text-xs col-span-2" placeholder="Icon" />
                  <Input value={v.title} onChange={(e) => { const vs = [...editContent.values!]; vs[idx] = { ...vs[idx], title: e.target.value }; setEditContent({ ...editContent, values: vs }); }} className="h-8 text-xs col-span-3" placeholder="Title" />
                  <Input value={v.desc} onChange={(e) => { const vs = [...editContent.values!]; vs[idx] = { ...vs[idx], desc: e.target.value }; setEditContent({ ...editContent, values: vs }); }} className="h-8 text-xs col-span-6" placeholder="Description" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive col-span-1" onClick={() => setEditContent({ ...editContent, values: editContent.values!.filter((_, i) => i !== idx) })}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Stats</CardTitle>
                <Button size="sm" onClick={() => setEditContent({ ...editContent, stats: [...(editContent.stats || []), { value: "0", label: "New Stat" }] })}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {editContent.stats?.map((s, idx) => (
                  <div key={idx} className="space-y-1 relative group">
                    <Input value={s.value} onChange={(e) => { const st = [...editContent.stats!]; st[idx] = { ...st[idx], value: e.target.value }; setEditContent({ ...editContent, stats: st }); }} className="h-8 text-sm font-bold" />
                    <Input value={s.label} onChange={(e) => { const st = [...editContent.stats!]; st[idx] = { ...st[idx], label: e.target.value }; setEditContent({ ...editContent, stats: st }); }} className="h-7 text-xs" />
                    <Button variant="ghost" size="icon" className="h-6 w-6 absolute -top-1 -right-1 text-destructive opacity-0 group-hover:opacity-100" onClick={() => setEditContent({ ...editContent, stats: editContent.stats!.filter((_, i) => i !== idx) })}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Team Members</CardTitle>
                <Button size="sm" onClick={() => setEditContent({ ...editContent, team: [...(editContent.team || []), { name: "New Member", role: "Role", avatar: "NM" }] })}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead className="text-xs">Avatar</TableHead><TableHead className="text-xs">Name</TableHead><TableHead className="text-xs">Role</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {editContent.team?.map((t, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="py-2"><Input value={t.avatar} onChange={(e) => { const tm = [...editContent.team!]; tm[idx] = { ...tm[idx], avatar: e.target.value }; setEditContent({ ...editContent, team: tm }); }} className="h-8 w-16 text-xs" /></TableCell>
                      <TableCell className="py-2"><Input value={t.name} onChange={(e) => { const tm = [...editContent.team!]; tm[idx] = { ...tm[idx], name: e.target.value }; setEditContent({ ...editContent, team: tm }); }} className="h-8 text-xs" /></TableCell>
                      <TableCell className="py-2"><Input value={t.role} onChange={(e) => { const tm = [...editContent.team!]; tm[idx] = { ...tm[idx], role: e.target.value }; setEditContent({ ...editContent, team: tm }); }} className="h-8 text-xs" /></TableCell>
                      <TableCell className="py-2"><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setEditContent({ ...editContent, team: editContent.team!.filter((_, i) => i !== idx) })}><Trash2 className="w-3.5 h-3.5" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* ====== CONTACT PAGE ====== */}
      {pageType === "contact" && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Contact Information</CardTitle>
                <Button size="sm" onClick={() => setEditContent({ ...editContent, contactInfo: [...(editContent.contactInfo || []), { icon: "MapPin", title: "New Info", text: "" }] })}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {editContent.contactInfo?.map((c, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                  <Input value={c.icon} onChange={(e) => { const ci = [...editContent.contactInfo!]; ci[idx] = { ...ci[idx], icon: e.target.value }; setEditContent({ ...editContent, contactInfo: ci }); }} className="h-8 text-xs col-span-2" placeholder="Icon" />
                  <Input value={c.title} onChange={(e) => { const ci = [...editContent.contactInfo!]; ci[idx] = { ...ci[idx], title: e.target.value }; setEditContent({ ...editContent, contactInfo: ci }); }} className="h-8 text-xs col-span-3" placeholder="Title" />
                  <Textarea value={c.text} onChange={(e) => { const ci = [...editContent.contactInfo!]; ci[idx] = { ...ci[idx], text: e.target.value }; setEditContent({ ...editContent, contactInfo: ci }); }} className="text-xs col-span-6" rows={2} placeholder="Content" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive col-span-1" onClick={() => setEditContent({ ...editContent, contactInfo: editContent.contactInfo!.filter((_, i) => i !== idx) })}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Contact Form</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label className="text-xs">Form Heading</Label>
                <Input value={editContent.formTitle || ""} onChange={(e) => setEditContent({ ...editContent, formTitle: e.target.value })} className="h-9" />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ====== FAQ PAGE ====== */}
      {pageType === "faq" && editContent.faqCategories && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">FAQ Categories & Questions</CardTitle>
              <Button size="sm" onClick={() => setEditContent({ ...editContent, faqCategories: [...(editContent.faqCategories || []), { category: "New Category", items: [{ q: "New question?", a: "Answer..." }] }] })}><Plus className="w-3.5 h-3.5 mr-1" /> Add Category</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {editContent.faqCategories.map((cat, ci) => (
              <div key={ci} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Input value={cat.category} onChange={(e) => { const fq = [...editContent.faqCategories!]; fq[ci] = { ...fq[ci], category: e.target.value }; setEditContent({ ...editContent, faqCategories: fq }); }} className="h-8 text-sm font-bold max-w-xs" />
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => { const fq = [...editContent.faqCategories!]; fq[ci] = { ...fq[ci], items: [...fq[ci].items, { q: "New question?", a: "Answer..." }] }; setEditContent({ ...editContent, faqCategories: fq }); }}><Plus className="w-3 h-3 mr-1" /> Q&A</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setEditContent({ ...editContent, faqCategories: editContent.faqCategories!.filter((_, i) => i !== ci) })}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                {cat.items.map((item, fi) => (
                  <div key={fi} className="grid grid-cols-12 gap-2 pl-4 border-l-2 border-primary/20">
                    <Input value={item.q} onChange={(e) => { const fq = [...editContent.faqCategories!]; fq[ci].items[fi] = { ...fq[ci].items[fi], q: e.target.value }; setEditContent({ ...editContent, faqCategories: fq }); }} className="h-8 text-xs font-semibold col-span-5" placeholder="Question" />
                    <Textarea value={item.a} onChange={(e) => { const fq = [...editContent.faqCategories!]; fq[ci].items[fi] = { ...fq[ci].items[fi], a: e.target.value }; setEditContent({ ...editContent, faqCategories: fq }); }} className="text-xs col-span-6" rows={2} placeholder="Answer" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive col-span-1" onClick={() => { const fq = [...editContent.faqCategories!]; fq[ci] = { ...fq[ci], items: fq[ci].items.filter((_, i) => i !== fi) }; setEditContent({ ...editContent, faqCategories: fq }); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ====== REFUND POLICY ====== */}
      {pageType === "refund" && (
        <>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Important Notice</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={editContent.refundNotice || ""} onChange={(e) => setEditContent({ ...editContent, refundNotice: e.target.value })} rows={3} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Refund Policies by Service</CardTitle>
                <Button size="sm" onClick={() => setEditContent({ ...editContent, refundPolicies: [...(editContent.refundPolicies || []), { title: "New Service", items: ["Policy item..."] }] })}><Plus className="w-3.5 h-3.5 mr-1" /> Add Service</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {editContent.refundPolicies?.map((p, pi) => (
                <div key={pi} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Input value={p.title} onChange={(e) => { const rp = [...editContent.refundPolicies!]; rp[pi] = { ...rp[pi], title: e.target.value }; setEditContent({ ...editContent, refundPolicies: rp }); }} className="h-8 text-sm font-bold max-w-xs" />
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => { const rp = [...editContent.refundPolicies!]; rp[pi] = { ...rp[pi], items: [...rp[pi].items, "New policy item..."] }; setEditContent({ ...editContent, refundPolicies: rp }); }}><Plus className="w-3 h-3 mr-1" /> Item</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setEditContent({ ...editContent, refundPolicies: editContent.refundPolicies!.filter((_, i) => i !== pi) })}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                  {p.items.map((item, ii) => (
                    <div key={ii} className="flex items-center gap-2 pl-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <Input value={item} onChange={(e) => { const rp = [...editContent.refundPolicies!]; rp[pi].items[ii] = e.target.value; setEditContent({ ...editContent, refundPolicies: rp }); }} className="h-8 text-xs flex-1" />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { const rp = [...editContent.refundPolicies!]; rp[pi] = { ...rp[pi], items: rp[pi].items.filter((_, i) => i !== ii) }; setEditContent({ ...editContent, refundPolicies: rp }); }}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Refund Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {editContent.refundTimeline?.map((t, ti) => (
                <div key={ti} className="grid grid-cols-12 gap-2 items-center">
                  <Input value={t.icon} onChange={(e) => { const rt = [...editContent.refundTimeline!]; rt[ti] = { ...rt[ti], icon: e.target.value }; setEditContent({ ...editContent, refundTimeline: rt }); }} className="h-8 text-xs col-span-2" placeholder="Icon" />
                  <Input value={t.label} onChange={(e) => { const rt = [...editContent.refundTimeline!]; rt[ti] = { ...rt[ti], label: e.target.value }; setEditContent({ ...editContent, refundTimeline: rt }); }} className="h-8 text-xs col-span-4" placeholder="Label" />
                  <Input value={t.desc} onChange={(e) => { const rt = [...editContent.refundTimeline!]; rt[ti] = { ...rt[ti], desc: e.target.value }; setEditContent({ ...editContent, refundTimeline: rt }); }} className="h-8 text-xs col-span-5" placeholder="Description" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive col-span-1" onClick={() => setEditContent({ ...editContent, refundTimeline: editContent.refundTimeline!.filter((_, i) => i !== ti) })}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {/* ====== CAREERS PAGE ====== */}
      {pageType === "careers" && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Perks & Benefits</CardTitle>
                <Button size="sm" onClick={() => setEditContent({ ...editContent, perks: [...(editContent.perks || []), { icon: "Heart", title: "New Perk", desc: "" }] })}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {editContent.perks?.map((p, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <Input value={p.icon} onChange={(e) => { const pk = [...editContent.perks!]; pk[idx] = { ...pk[idx], icon: e.target.value }; setEditContent({ ...editContent, perks: pk }); }} className="h-8 text-xs col-span-2" />
                  <Input value={p.title} onChange={(e) => { const pk = [...editContent.perks!]; pk[idx] = { ...pk[idx], title: e.target.value }; setEditContent({ ...editContent, perks: pk }); }} className="h-8 text-xs col-span-3" />
                  <Input value={p.desc} onChange={(e) => { const pk = [...editContent.perks!]; pk[idx] = { ...pk[idx], desc: e.target.value }; setEditContent({ ...editContent, perks: pk }); }} className="h-8 text-xs col-span-6" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive col-span-1" onClick={() => setEditContent({ ...editContent, perks: editContent.perks!.filter((_, i) => i !== idx) })}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Open Positions</CardTitle>
                <Button size="sm" onClick={() => setEditContent({ ...editContent, positions: [...(editContent.positions || []), { id: Date.now(), title: "New Position", dept: "Department", location: "Dhaka", type: "Full-time", description: "" }] })}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {editContent.positions?.map((pos, idx) => (
                <div key={pos.id} className="border rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Input value={pos.title} onChange={(e) => { const ps = [...editContent.positions!]; ps[idx] = { ...ps[idx], title: e.target.value }; setEditContent({ ...editContent, positions: ps }); }} className="h-8 text-xs font-bold" placeholder="Title" />
                    <Input value={pos.dept} onChange={(e) => { const ps = [...editContent.positions!]; ps[idx] = { ...ps[idx], dept: e.target.value }; setEditContent({ ...editContent, positions: ps }); }} className="h-8 text-xs" placeholder="Department" />
                    <Input value={pos.location} onChange={(e) => { const ps = [...editContent.positions!]; ps[idx] = { ...ps[idx], location: e.target.value }; setEditContent({ ...editContent, positions: ps }); }} className="h-8 text-xs" placeholder="Location" />
                    <div className="flex gap-1">
                      <Input value={pos.type} onChange={(e) => { const ps = [...editContent.positions!]; ps[idx] = { ...ps[idx], type: e.target.value }; setEditContent({ ...editContent, positions: ps }); }} className="h-8 text-xs flex-1" placeholder="Type" />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setEditContent({ ...editContent, positions: editContent.positions!.filter((_, i) => i !== idx) })}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                  <Textarea value={pos.description} onChange={(e) => { const ps = [...editContent.positions!]; ps[idx] = { ...ps[idx], description: e.target.value }; setEditContent({ ...editContent, positions: ps }); }} className="text-xs" rows={2} placeholder="Job description" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Careers Email</CardTitle></CardHeader>
            <CardContent>
              <Input value={editContent.careersEmail || ""} onChange={(e) => setEditContent({ ...editContent, careersEmail: e.target.value })} className="h-9 max-w-sm" />
            </CardContent>
          </Card>
        </>
      )}

      {/* ====== SERVICE PAGES ====== */}
      {pageType === "service" && editContent.serviceContent && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Service Page Content</CardTitle>
            <CardDescription className="text-xs">Edit the intro text, features, and process steps for this service</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Introduction Text</Label>
              <Textarea value={editContent.serviceContent.intro || ""} onChange={(e) => setEditContent({ ...editContent, serviceContent: { ...editContent.serviceContent!, intro: e.target.value } })} rows={3} />
            </div>

            {editContent.serviceContent.features && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold">Features</Label>
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditContent({ ...editContent, serviceContent: { ...editContent.serviceContent!, features: [...(editContent.serviceContent!.features || []), { icon: "Star", title: "New Feature", desc: "" }] } });
                  }}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                </div>
                {editContent.serviceContent.features.map((f, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <Input value={f.icon} onChange={(e) => { const fs = [...editContent.serviceContent!.features!]; fs[idx] = { ...fs[idx], icon: e.target.value }; setEditContent({ ...editContent, serviceContent: { ...editContent.serviceContent!, features: fs } }); }} className="h-8 text-xs col-span-2" />
                    <Input value={f.title} onChange={(e) => { const fs = [...editContent.serviceContent!.features!]; fs[idx] = { ...fs[idx], title: e.target.value }; setEditContent({ ...editContent, serviceContent: { ...editContent.serviceContent!, features: fs } }); }} className="h-8 text-xs col-span-3" />
                    <Input value={f.desc} onChange={(e) => { const fs = [...editContent.serviceContent!.features!]; fs[idx] = { ...fs[idx], desc: e.target.value }; setEditContent({ ...editContent, serviceContent: { ...editContent.serviceContent!, features: fs } }); }} className="h-8 text-xs col-span-6" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive col-span-1" onClick={() => setEditContent({ ...editContent, serviceContent: { ...editContent.serviceContent!, features: editContent.serviceContent!.features!.filter((_, i) => i !== idx) } })}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}

            {editContent.serviceContent.steps && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold">Process Steps</Label>
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditContent({ ...editContent, serviceContent: { ...editContent.serviceContent!, steps: [...(editContent.serviceContent!.steps || []), { step: String((editContent.serviceContent!.steps?.length || 0) + 1), title: "New Step", desc: "" }] } });
                  }}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                </div>
                {editContent.serviceContent.steps.map((s, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <Input value={s.step} onChange={(e) => { const ss = [...editContent.serviceContent!.steps!]; ss[idx] = { ...ss[idx], step: e.target.value }; setEditContent({ ...editContent, serviceContent: { ...editContent.serviceContent!, steps: ss } }); }} className="h-8 text-xs col-span-1 text-center font-bold" />
                    <Input value={s.title} onChange={(e) => { const ss = [...editContent.serviceContent!.steps!]; ss[idx] = { ...ss[idx], title: e.target.value }; setEditContent({ ...editContent, serviceContent: { ...editContent.serviceContent!, steps: ss } }); }} className="h-8 text-xs col-span-4" />
                    <Input value={s.desc} onChange={(e) => { const ss = [...editContent.serviceContent!.steps!]; ss[idx] = { ...ss[idx], desc: e.target.value }; setEditContent({ ...editContent, serviceContent: { ...editContent.serviceContent!, steps: ss } }); }} className="h-8 text-xs col-span-6" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive col-span-1" onClick={() => setEditContent({ ...editContent, serviceContent: { ...editContent.serviceContent!, steps: editContent.serviceContent!.steps!.filter((_, i) => i !== idx) } })}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}

            <Separator />
            <div className="flex items-center gap-3">
              <Label className="text-xs">Page Visible</Label>
              <Switch checked={editContent.serviceContent.visible} onCheckedChange={(v) => setEditContent({ ...editContent, serviceContent: { ...editContent.serviceContent!, visible: v } })} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ====== BLOG PAGE ====== */}
      {pageType === "blog" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Blog Categories</CardTitle>
              <Button size="sm" onClick={() => setEditContent({ ...editContent, blogCategories: [...(editContent.blogCategories || []), "New Category"] })}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
            </div>
            <CardDescription className="text-xs">Blog posts are managed in the dedicated Blog CMS section</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {editContent.blogCategories?.map((cat, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input value={cat} onChange={(e) => { const bc = [...editContent.blogCategories!]; bc[idx] = e.target.value; setEditContent({ ...editContent, blogCategories: bc }); }} className="h-8 text-xs flex-1 max-w-xs" />
                {cat !== "All" && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setEditContent({ ...editContent, blogCategories: editContent.blogCategories!.filter((_, i) => i !== idx) })}><Trash2 className="w-3.5 h-3.5" /></Button>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CMSPages;
