import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Quote, Instagram, Facebook, Linkedin, Youtube, Globe, Music2, Twitter } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";
import { useTranslation } from "react-i18next";

interface Testimonial {
  id: string;
  name: string;
  role: string | null;
  message: string;
  photo_url: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  tiktok_url?: string | null;
  youtube_url?: string | null;
  website_url?: string | null;
  message_en?: string | null;
  message_pt?: string | null;
  role_en?: string | null;
  role_pt?: string | null;
}

export function TestimonialsSection() {
  return <TestimonialsInner />;
}

function SocialLinks({ t }: { t: Testimonial }) {
  const items = [
    { url: t.instagram_url, Icon: Instagram, label: "Instagram" },
    { url: t.facebook_url, Icon: Facebook, label: "Facebook" },
    { url: t.linkedin_url, Icon: Linkedin, label: "LinkedIn" },
    { url: t.twitter_url, Icon: Twitter, label: "X" },
    { url: t.tiktok_url, Icon: Music2, label: "TikTok" },
    { url: t.youtube_url, Icon: Youtube, label: "YouTube" },
    { url: t.website_url, Icon: Globe, label: "Sitio web" },
  ].filter((i) => i.url);
  if (items.length === 0) return null;
  return (
    <div className="mt-4 flex items-center gap-2 flex-wrap">
      {items.map(({ url, Icon, label }) => (
        <a
          key={label}
          href={url as string}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="h-10 w-10 grid place-items-center rounded-full border border-border/60 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
        >
          <Icon className="h-5 w-5" />
        </a>
      ))}
    </div>
  );
}

function TestimonialsInner() {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage || "es").slice(0, 2);
  const [items, setItems] = useState<Testimonial[]>([]);
  const [emblaRef] = useEmblaCarousel(
    { loop: true, align: "start", dragFree: true },
    [AutoScroll({ speed: 0.5, stopOnInteraction: false, stopOnMouseEnter: true })]
  );

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("testimonials")
        .select("id,name,role,message,photo_url,instagram_url,facebook_url,linkedin_url,twitter_url,tiktok_url,youtube_url,website_url,message_en,message_pt,role_en,role_pt")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(12);
      setItems((data as Testimonial[]) || []);
    })();
  }, []);

  if (items.length === 0) return null;

  // Duplicar items para el efecto infinito
  const list = [...items, ...items];

  const pickMessage = (t: Testimonial) => {
    if (lang === "en") return t.message_en?.trim() || t.message;
    if (lang === "pt") return t.message_pt?.trim() || t.message;
    return t.message;
  };
  const pickRole = (t: Testimonial) => {
    if (lang === "en") return t.role_en?.trim() || t.role;
    if (lang === "pt") return t.role_pt?.trim() || t.role;
    return t.role;
  };

  return (
    <section id="testimonials" className="border-t border-border/60 py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-xs font-medium mb-4">
            <Star className="h-3.5 w-3.5 text-warning fill-warning" />
            Lo que dicen
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Recomendado por <span className="text-gradient">creadores</span>
          </h2>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 z-10 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 z-10 bg-gradient-to-l from-background to-transparent" />

          <div ref={emblaRef} className="overflow-hidden">
            <div className="flex gap-5 py-6">
              {list.map((t, i) => (
                <article
                  key={`${t.id}-${i}`}
                  className="relative shrink-0 basis-[320px] sm:basis-[380px] rounded-2xl border border-border/60 bg-card/80 p-6 hover:border-primary/40 transition-colors"
                >
                  <Quote className="absolute top-4 right-4 h-6 w-6 text-primary/20" />
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={t.photo_url || undefined} alt={t.name} />
                      <AvatarFallback>{t.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{t.name}</div>
                      {pickRole(t) && <div className="text-xs text-muted-foreground truncate">{pickRole(t)}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 mb-3">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-warning text-warning" />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">"{pickMessage(t)}"</p>
                  <SocialLinks t={t} />
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
