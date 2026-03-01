import { useCmsPageContent } from "@/hooks/useCmsContent";
import { Skeleton } from "@/components/ui/skeleton";

const Privacy = () => {
  const { data: content, isLoading } = useCmsPageContent("/privacy");

  const hero = content?.hero || { title: "Privacy Policy", subtitle: "Last updated: February 25, 2026" };
  const sections = content?.sections?.filter(s => s.visible).sort((a, b) => a.order - b.order) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="bg-gradient-to-br from-[hsl(217,91%,50%)] to-[hsl(224,70%,28%)] pt-24 lg:pt-32 pb-16">
          <div className="container mx-auto px-4 text-center">
            <Skeleton className="h-10 w-48 mx-auto mb-3 bg-white/20" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <section className={`relative bg-gradient-to-br ${hero.gradient || "from-[hsl(217,91%,50%)] to-[hsl(224,70%,28%)]"} pt-24 lg:pt-32 pb-16 overflow-hidden`}>
        <div className="container mx-auto px-4 relative text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-3 tracking-tight">{hero.title}</h1>
          <p className="text-white/60 text-sm sm:text-base">{hero.subtitle}</p>
        </div>
      </section>
      <section className="py-10 sm:py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="space-y-8">
            {sections.map((s) => (
              <div key={s.id}>
                <h2 className="text-lg font-bold mb-2">{s.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.content}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Privacy;
