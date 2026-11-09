"use client";

import { useState } from "react";
import { hashtagsOf } from "@/lib/create/types";
import { useStructuredPublish } from "@/lib/create/structured";
import { AREA, Count, Label } from "./fields";
import { FormFrame } from "./frame";

const TITLE_MAX = 140;
const BODY_MAX = 3000;

// Course Desk question: a short title plus optional details. Replies are comments. The server rejects questions
// outside a Course Desk, so this form is only reachable with ?community=<desk slug>.
export function QuestionForm({ onClose }: { onClose: () => void }) {
  const pub = useStructuredPublish();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const problem = !title.trim() ? "Ask your question in a few words" : null;

  const submit = () =>
    void pub.run(
      [],
      async () => ({
        type: "post",
        subtype: "question",
        caption: title.trim(),
        hashtags: hashtagsOf(`${title} ${body}`),
        visibility: "public",
        allow_comments: true,
        content: { title: title.trim(), body: body.trim() },
      }),
      "?tab=discussions",
    );

  return (
    <FormFrame
      title="Ask a question"
      cta="Post question"
      ready={problem === null}
      hint={problem}
      dirty={!!title.trim() || !!body.trim()}
      pub={pub}
      onSubmit={submit}
      onClose={onClose}
    >
      <Label>Question</Label>
      <textarea
        className={`${AREA} min-h-[84px]`}
        placeholder="What do you want to ask?"
        maxLength={TITLE_MAX}
        value={title}
        disabled={pub.busy}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Count n={title.length} max={TITLE_MAX} />

      <Label hint="Optional">Details</Label>
      <textarea
        className={`${AREA} min-h-[140px]`}
        placeholder="Add anything that helps someone answer: the topic, the page, what you already tried."
        maxLength={BODY_MAX}
        value={body}
        disabled={pub.busy}
        onChange={(e) => setBody(e.target.value)}
      />
      <Count n={body.length} max={BODY_MAX} />
    </FormFrame>
  );
}
