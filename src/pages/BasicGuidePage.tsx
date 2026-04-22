import { ArrowRight, BookOpen, Coins, Download, Film, History, ImagePlus, Sparkles, UserRound } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import nanoBananaLogo from "@/assets/logos/nano-banana.png";
import videoPromptExample from "@/assets/video-prompt-example.mp4";

const stepIcons = [ImagePlus, Sparkles, Coins, History, Download];
const guideKeys = ["image", "video", "avatar"] as const;
type GuideKey = typeof guideKeys[number];

type PromptBlock = {
  title: string;
  copy: string;
  example: string;
};

export default function BasicGuidePage() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const guide: GuideKey = pathname.endsWith("/avatars") ? "avatar" : pathname.endsWith("/videos") ? "video" : "image";
  const isVideoGuide = guide === "video";
  const isAvatarGuide = guide === "avatar";
  const blocks = t(`guide.${guide}.blocks`, { returnObjects: true }) as PromptBlock[];
  const templates = t(`guide.${guide}.templates`, { returnObjects: true }) as string[];

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-col gap-5 border-b border-border/60 pb-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <BookOpen className="h-4 w-4" /> {t("guide.badge")}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t("guide.title")}
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              {t("guide.subtitle")}
            </p>
          </div>
          <Button asChild className="w-full gap-2 sm:w-auto">
            <Link to="/app/catalog">
              {t("guide.catalogCta")} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {stepIcons.map((Icon, index) => (
            <article key={t(`guide.steps.${index}.title`)} className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold text-muted-foreground">{t("guide.stepLabel", { number: index + 1 })}</span>
              </div>
              <h2 className="text-xl font-semibold tracking-tight">{t(`guide.steps.${index}.title`)}</h2>
              <p className="mt-2 leading-7 text-muted-foreground">{t(`guide.steps.${index}.description`)}</p>
            </article>
          ))}
        </div>

        <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="text-2xl font-semibold tracking-tight">{t("guide.tipsTitle")}</h2>
          <ul className="mt-4 grid gap-3 text-muted-foreground sm:grid-cols-2">
            {(t("guide.tips", { returnObjects: true }) as string[]).map((tip) => (
              <li key={tip}>• {tip}</li>
            ))}
          </ul>
        </section>

        <section className="grid gap-6 border-t border-border/60 pt-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {isVideoGuide ? (
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Film className="h-6 w-6" />
                </div>
              ) : isAvatarGuide ? (
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <UserRound className="h-6 w-6" />
                </div>
              ) : (
                <img src={nanoBananaLogo} alt="Nano Banana" className="h-12 w-12 rounded-md object-contain" />
              )}
              <div>
                <p className="text-sm font-medium text-primary">{t(`guide.${guide}.eyebrow`)}</p>
                <h2 className="text-2xl font-semibold tracking-tight">{t(`guide.${guide}.title`)}</h2>
              </div>
            </div>
            <p className="leading-7 text-muted-foreground">{t(`guide.${guide}.description`)}</p>
            <Button asChild variant="secondary" className="gap-2">
              <Link to={isAvatarGuide ? "/app/catalog?cat=avatars" : isVideoGuide ? "/app/catalog?cat=video" : "/app/catalog?cat=image"}>
                {t(`guide.${guide}.tryCta`)} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4">
            {blocks.map((block) => (
              <article key={block.title} className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <h3 className="font-semibold tracking-tight text-foreground">{block.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{block.copy}</p>
                <div className="mt-4 rounded-md bg-muted p-4 text-sm leading-6 text-foreground">
                  {block.example}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="text-2xl font-semibold tracking-tight">{t("guide.templatesTitle")}</h2>
          <div className="mt-4 grid gap-3">
            {templates.map((template) => (
              <div key={template} className="rounded-md bg-muted p-4 text-sm leading-6 text-muted-foreground">
                {template}
              </div>
            ))}
          </div>
        </section>

        {isVideoGuide && (
          <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Film className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary">{t("guide.video.exampleEyebrow")}</p>
                <h2 className="text-2xl font-semibold tracking-tight">{t("guide.video.exampleTitle")}</h2>
              </div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
              <div className="overflow-hidden rounded-md border border-border bg-muted">
                <video
                  src={videoPromptExample}
                  className="aspect-video w-full object-cover"
                  controls
                  preload="metadata"
                />
              </div>
              <div className="rounded-md bg-muted p-4 text-sm leading-6 text-foreground">
                {t("guide.video.featuredPrompt")}
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
