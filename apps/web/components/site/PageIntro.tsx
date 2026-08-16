type PageIntroProps = {
  eyebrow?: string;
  title: React.ReactNode;
  body: string;
  align?: "left" | "center";
  tone?: "default" | "inverse";
};

export function PageIntro({ eyebrow, title, body, align = "left", tone = "default" }: PageIntroProps) {
  const inverse = tone === "inverse";

  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {eyebrow ? (
        <div className={`mb-4 flex items-center gap-3 ${align === "center" ? "justify-center" : ""}`}>
          <span className="h-px w-12 bg-gradient-to-r from-transparent via-obligon-green to-transparent" />
          <p className={`text-xs uppercase tracking-[1.6px] ${inverse ? "text-obligon-lime" : "text-obligon-green"}`}>
            {eyebrow}
          </p>
        </div>
      ) : null}
      <h1 className={`font-display text-[40px] font-extrabold leading-[1.08] tracking-[-0.8px] sm:text-5xl lg:text-[64px] lg:leading-[72px] ${inverse ? "text-white" : "text-obligon-navy"}`}>
        {title}
      </h1>
      <p className={`mt-5 text-base leading-6 sm:text-lg sm:leading-7 ${inverse ? "text-white/70" : "text-obligon-text"}`}>
        {body}
      </p>
    </div>
  );
}
