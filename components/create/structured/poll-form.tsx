"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { hashtagsOf, type Visibility } from "@/lib/create/types";
import { useStructuredPublish } from "@/lib/create/structured";
import { AREA, Chip, Count, INPUT, Label, ToggleRow, VisibilityChips } from "./fields";
import { FormFrame } from "./frame";

const EXPIRY: [number, string][] = [
  [0, "No expiry"],
  [1, "24 hours"],
  [3, "3 days"],
  [7, "7 days"],
];
const newOption = () => ({ id: crypto.randomUUID(), text: "" });

export function PollForm({ onClose }: { onClose: () => void }) {
  const pub = useStructuredPublish();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(() => [newOption(), newOption()]);
  const [multiple, setMultiple] = useState(false);
  const [days, setDays] = useState(0);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [allowComments, setAllowComments] = useState(true);

  const clean = options.map((o) => o.text.trim()).filter(Boolean);
  const dup = new Set(clean.map((o) => o.toLowerCase())).size !== clean.length;
  const problem = !question.trim() ? "Ask a question" : clean.length < 2 ? "Add at least two options" : dup ? "Options must be different" : null;

  const submit = () =>
    void pub.run([], async () => ({
      type: "post",
      subtype: "poll",
      caption: question.trim(),
      hashtags: hashtagsOf(question),
      visibility,
      allow_comments: allowComments,
      content: {
        question: question.trim(),
        options: clean,
        multiple,
        closes_at: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
      },
    }));

  return (
    <FormFrame title="New poll" cta="Post poll" ready={problem === null} hint={problem} dirty={!!question.trim() || clean.length > 0} pub={pub} onSubmit={submit} onClose={onClose}>
      <Label>Question</Label>
      <textarea className={`${AREA} min-h-[96px]`} placeholder="What do you want to ask?" maxLength={200} value={question} disabled={pub.busy} onChange={(e) => setQuestion(e.target.value)} />
      <Count n={question.length} max={200} />

      <Label hint="2 to 6">Options</Label>
      <div className="space-y-2">
        {options.map((o, i) => (
          <div key={o.id} className="flex items-center gap-2">
            <input
              className={INPUT}
              placeholder={`Option ${i + 1}`}
              maxLength={80}
              value={o.text}
              disabled={pub.busy}
              onChange={(e) => setOptions((p) => p.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)))}
            />
            {options.length > 2 && (
              <button type="button" aria-label="Remove option" disabled={pub.busy} onClick={() => setOptions((p) => p.filter((x) => x.id !== o.id))} className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-white/8">
                <Icon name="close" className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      {options.length < 6 && (
        <button type="button" disabled={pub.busy} onClick={() => setOptions((p) => [...p, newOption()])} className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-surface-interactive px-3.5 py-2 text-secondary font-bold text-fg">
          <Icon name="plus" className="size-4" />
          Add option
        </button>
      )}

      <ToggleRow label="Allow multiple answers" sub="Voters can pick more than one option" on={multiple} onChange={setMultiple} />

      <Label>Closes</Label>
      <div className="flex flex-wrap gap-2">
        {EXPIRY.map(([d, l]) => (
          <Chip key={d} on={days === d} disabled={pub.busy} onClick={() => setDays(d)}>
            {l}
          </Chip>
        ))}
      </div>

      <VisibilityChips value={visibility} onChange={setVisibility} disabled={pub.busy} />
      <ToggleRow label="Allow comments" on={allowComments} onChange={setAllowComments} />
    </FormFrame>
  );
}
