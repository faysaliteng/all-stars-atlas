import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { PenLine, Plus, Search, Eye, Trash2, MoreHorizontal, Calendar, User } from "lucide-react";
import { BLOG_POSTS } from "@/lib/content-data";
import { getCollection, addToCollection, updateInCollection, removeFromCollection } from "@/lib/local-store";
import { useToast } from "@/hooks/use-toast";

const STORE_KEY = "cms_blog_posts";
const statusColors: Record<string, string> = { published: "bg-success/10 text-success", draft: "bg-muted text-muted-foreground", scheduled: "bg-warning/10 text-warning" };
const categories = ["Destinations", "Travel Tips", "Visa Guide", "Hotels", "Medical"];

const emptyPost = { title: "", excerpt: "", category: "Destinations", author: "", img: "", status: "draft" as const, readTime: "5 min", views: 0, date: "" };

const CMSBlog = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [posts, setPosts] = useState(() => getCollection(STORE_KEY, BLOG_POSTS.map(p => ({ ...p, id: String(p.id) }))));
  const [showCreate, setShowCreate] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [form, setForm] = useState(emptyPost);

  const filtered = posts.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));

  const handleSave = () => {
    if (!form.title) { toast({ title: "Error", description: "Title is required", variant: "destructive" }); return; }
    if (editingPost) {
      const updated = updateInCollection(STORE_KEY, BLOG_POSTS.map(p => ({ ...p, id: String(p.id) })), editingPost.id, {
        ...form,
        date: form.date || editingPost.date,
      });
      setPosts([...updated]);
      toast({ title: "Post Updated", description: `"${form.title}" has been updated.` });
    } else {
      const newPost = {
        ...form,
        id: `post-${Date.now()}`,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        views: 0,
      };
      const updated = addToCollection(STORE_KEY, BLOG_POSTS.map(p => ({ ...p, id: String(p.id) })), newPost);
      setPosts([...updated]);
      toast({ title: "Post Created", description: `"${form.title}" has been created.` });
    }
    setShowCreate(false);
    setEditingPost(null);
    setForm(emptyPost);
  };

  const handleEdit = (post: any) => {
    setEditingPost(post);
    setForm({ title: post.title, excerpt: post.excerpt || "", category: post.category, author: post.author, img: post.img || "", status: post.status, readTime: post.readTime || "5 min", views: post.views || 0, date: post.date });
    setShowCreate(true);
  };

  const handleDelete = (post: any) => {
    const updated = removeFromCollection(STORE_KEY, BLOG_POSTS.map(p => ({ ...p, id: String(p.id) })), post.id);
    setPosts([...updated]);
    toast({ title: "Deleted", description: `"${post.title}" has been removed.`, variant: "destructive" });
  };

  const openNew = () => {
    setEditingPost(null);
    setForm(emptyPost);
    setShowCreate(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Blog & Articles</h1><p className="text-sm text-muted-foreground mt-1">{posts.length} posts • {posts.filter(p => p.status === "published").length} published</p></div>
        <Button className="font-bold" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> New Post</Button>
      </div>
      <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search posts..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground"><p className="font-semibold">No posts found</p></CardContent></Card>
        ) : filtered.map((post) => (
          <Card key={post.id} className="hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-4 p-4">
              {post.img && <img src={post.img} alt="" className="w-14 h-10 rounded object-cover hidden sm:block" />}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{post.title}</h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" /> {post.author}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {post.date}</span>
                  {post.views > 0 && <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {post.views.toLocaleString()}</span>}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">{post.category}</Badge>
              <Badge className={`${statusColors[post.status] || ''} text-[10px] font-semibold border-0`}>{post.status}</Badge>
              <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => window.open("/blog", "_blank")}><Eye className="w-4 h-4 mr-2" /> View</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleEdit(post)}><PenLine className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(post)}><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) { setEditingPost(null); setForm(emptyPost); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingPost ? "Edit Post" : "New Blog Post"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5"><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Post title" /></div>
            <div className="space-y-1.5"><Label>Excerpt</Label><Textarea value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} placeholder="Short description..." rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Author</Label><Input value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} placeholder="Author name" /></div>
              <div className="space-y-1.5"><Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Image URL</Label><Input value={form.img} onChange={e => setForm(f => ({ ...f, img: e.target.value }))} placeholder="https://..." /></div>
              <div className="space-y-1.5"><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Read Time</Label><Input value={form.readTime} onChange={e => setForm(f => ({ ...f, readTime: e.target.value }))} placeholder="5 min" /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSave}>{editingPost ? "Update Post" : "Create Post"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CMSBlog;
