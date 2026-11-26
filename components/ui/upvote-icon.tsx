// Up-arrow used for upvotes on Course Desk questions and answers.
export function UpvoteIcon({ filled = false, className = "size-6" }: { filled?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4 4.5 12H9v7.5h6V12h4.5L12 4Z" />
    </svg>
  );
}
