"use client";

// Feuille du bas d'information (même coque qu'InstallSheet) : un texte et « J'ai compris ».
export function InfoSheet({ title, text, ok, onClose }: { title: string; text: string; ok: string; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-[rgba(20,20,18,.45)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-title"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col gap-4 rounded-t-[22px] bg-white px-5 pt-2.5 pb-[max(24px,env(safe-area-inset-bottom))]"
      >
        <span className="h-[5px] w-9 self-center rounded-[3px] bg-[#DAD8D2]" />
        <h2 id="info-title" className="m-0 text-[22px] leading-[1.2] font-semibold tracking-[-.02em]">
          {title}
        </h2>
        <p className="m-0 text-[15px] leading-[1.45] text-muted">{text}</p>
        <button
          type="button"
          onClick={onClose}
          className="h-[50px] cursor-pointer rounded-xl border-0 bg-ink text-[16px] leading-none font-semibold text-white"
        >
          {ok}
        </button>
      </div>
    </div>
  );
}
