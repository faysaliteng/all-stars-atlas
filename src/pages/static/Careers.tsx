import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Heart, Rocket, ArrowRight, Briefcase } from "lucide-react";

const openPositions = [
  { id: 1, title: "Senior Full-Stack Developer", dept: "Engineering", location: "Dhaka, Bangladesh", type: "Full-time", description: "Build and maintain our core booking platform using React, Node.js, and MySQL." },
  { id: 2, title: "UI/UX Designer", dept: "Design", location: "Dhaka, Bangladesh", type: "Full-time", description: "Design intuitive user experiences for our web and mobile platforms." },
  { id: 3, title: "Customer Support Executive", dept: "Operations", location: "Dhaka, Bangladesh", type: "Full-time", description: "Provide 24/7 support to travellers via phone, email, and chat." },
  { id: 4, title: "Digital Marketing Manager", dept: "Marketing", location: "Dhaka / Remote", type: "Full-time", description: "Lead our digital marketing strategy across SEO, SEM, and social media." },
  { id: 5, title: "Travel Operations Manager", dept: "Operations", location: "Dhaka, Bangladesh", type: "Full-time", description: "Manage airline and hotel partnerships, negotiate rates, and ensure service quality." },
  { id: 6, title: "Content Writer", dept: "Marketing", location: "Remote", type: "Part-time", description: "Create engaging travel content, blog posts, and destination guides." },
];

const perks = [
  { icon: Heart, title: "Health Insurance", desc: "Comprehensive health coverage for you and your family" },
  { icon: Rocket, title: "Travel Benefits", desc: "Discounted flights, hotels, and holiday packages" },
  { icon: Users, title: "Great Team", desc: "Work with passionate travel enthusiasts" },
  { icon: Briefcase, title: "Growth", desc: "Career development opportunities and training" },
];

const Careers = () => (
  <div className="min-h-screen bg-muted/30">
    <section className="relative bg-gradient-to-br from-[hsl(167,72%,41%)] to-[hsl(217,91%,50%)] pt-24 lg:pt-32 pb-16">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-3 tracking-tight">Join Our Team</h1>
        <p className="text-white/60 text-sm sm:text-base max-w-lg mx-auto">Help us revolutionize travel in Bangladesh. We're always looking for talented people.</p>
      </div>
    </section>

    <section className="py-10 sm:py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl font-bold mb-6">Why Seven Trip?</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {perks.map(p => (
            <Card key={p.title}>
              <CardContent className="p-5 text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <p.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-bold mb-1">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <h2 className="text-2xl font-bold mb-6">Open Positions</h2>
        <div className="space-y-4">
          {openPositions.map(pos => (
            <Card key={pos.id} className="hover:shadow-lg transition-all">
              <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{pos.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{pos.description}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">{pos.dept}</Badge>
                    <Badge variant="outline" className="text-xs"><MapPin className="w-3 h-3 mr-1" />{pos.location}</Badge>
                    <Badge variant="outline" className="text-xs">{pos.type}</Badge>
                  </div>
                </div>
                <Button className="font-bold shrink-0">
                  Apply <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">Don't see a role that fits? Send your CV to</p>
          <a href="mailto:careers@seventrip.com.bd" className="text-primary font-bold text-lg hover:underline">careers@seventrip.com.bd</a>
        </div>
      </div>
    </section>
  </div>
);

export default Careers;
